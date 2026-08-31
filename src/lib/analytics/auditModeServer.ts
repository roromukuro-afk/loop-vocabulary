import { AUDIT_MODE_HEADER, AUDIT_MODE_COOKIE } from "./auditMode";

/**
 * 監査モード(analytics除外・広告抑止)の起動判定のうち、秘密トークン照合を含む
 * サーバー専用ロジック。middleware.ts・route handler(resolveAnalyticsRequestContext.ts
 * 経由)からのみimportすること。
 *
 * ./auditMode.ts はクライアントバンドルにも含まれる(layout.tsx・AdSenseLoader.tsxが
 * 直接importする)ため、node:crypto・process.env.LV_AUDIT_TOKEN(秘密)はこちらの
 * ファイルにのみ置く(意図的な分離。auditMode.tsのコメント参照)。
 *
 * オーナー指摘対応(セキュリティ、Issue #136是正の再強化): 以前は AUDIT_MODE_HEADER の値が
 * 固定文字列 "1" であれば誰でも監査モードを起動できた。x-lv-e2e-test はブラウザからも
 * 自由に送信できるヘッダーであり、認可目的でなくても「攻撃者が広告収益・計測データを
 * 任意に抑止できる」計測品質上の脆弱性だった。このためヘッダー値そのものを、
 * server-onlyの環境変数と突き合わせる秘密トークンに置き換える
 * (ヘッダー名・Cookie名は変更しない。監査スクリプト側だけが値を知っていればよい)。
 *
 * - clientへ絶対に公開しない: このファイルはmiddleware.ts・route handlerからのみ
 *   importされ、client component("use client")からは一切importされない
 *   (importするとprocess.env.LV_AUDIT_TOKENの読み取りごとクライアントバンドルへ
 *   混入しうるため、client component側は./auditMode.tsだけを使う設計にしている)。
 *   node:crypto等のNode専用APIは意図的に使わない: middleware.tsはNext.jsの既定では
 *   Edge Runtimeで動作し、Edge RuntimeはNode専用API(node:crypto含む)をサポートしない
 *   ため、下のsafeEqual()はNode/Edge/ブラウザのどこでも動く素のJavaScriptだけで
 *   タイミング攻撃耐性のある比較を実装している。
 * - `NEXT_PUBLIC_` prefixも付けない(Next.jsはNEXT_PUBLIC_を持つ変数のみをクライアント
 *   バンドルへ埋め込む。この変数名にはprefixが無いため、ビルド時にクライアントJSへ
 *   絶対に混入しない)。
 * - CI/監査スクリプト側だけがこのヘッダーへ値を設定する(scripts/testing配下からのみ
 *   参照・送信され、アプリのクライアントコードは一切参照しない)。
 * - 未設定・不十分な長さ(誤って"1"のような短い値を設定してしまった場合を含む)は
 *   常に「一致しない」= 監査モードは絶対に起動しない、fail-closedで扱う。
 * - 秘密の値自体はここでもどこでもログ・console出力しない。
 */
const AUDIT_TOKEN_MIN_LENGTH = 32;

function getConfiguredAuditToken(): string | null {
  const token = process.env.LV_AUDIT_TOKEN;
  if (!token || token.length < AUDIT_TOKEN_MIN_LENGTH) return null;
  return token;
}

/**
 * タイミング攻撃(文字列比較の早期returnによる部分一致漏洩)を避けるための定数時間比較。
 * Node専用API(crypto.timingSafeEqual等)を使わず素のJavaScriptだけで実装している
 * 理由はファイル先頭のコメント参照(Edge Runtime互換のため)。
 * 長さが異なる場合のみ早期returnする(トークン長の漏洩は許容: 秘密の中身ではなく
 * 長さだけであり、AUDIT_TOKEN_MIN_LENGTH以上という制約以外に長さそのものへ
 * 依存する保護目的が無いため実用上問題にならない。中身の比較はXOR蓄積で
 * 1文字目の不一致で打ち切らないようにしている)。
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * AUDIT_MODE_HEADERの値を、環境変数 LV_AUDIT_TOKEN と照合する。
 * 一致しない場合(トークン未設定・長さ不足・値が違う・ヘッダー自体が無い)は
 * 例外を投げずfalseを返す=「通常アクセスとして扱う」(オーナー指摘の契約どおり)。
 */
export function isAuditHeaderAuthorized(headerValue: string | null | undefined): boolean {
  const token = getConfiguredAuditToken();
  if (!token || !headerValue) return false;
  return safeEqual(headerValue, token);
}

/** Cookieヘッダーから単一の値を取り出す(NextRequest/Request両方で使える最小実装)。 */
function readCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() !== name) continue;
    try {
      return decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      return part.slice(idx + 1).trim();
    }
  }
  return null;
}

/**
 * リクエストが監査モードの対象かどうかを判定する唯一の場所。
 * (1) AUDIT_MODE_HEADERが秘密トークンと一致する(監査スクリプトが明示的に開始)、または
 * (2) 直前のレスポンスでmiddleware.tsがセットしたAUDIT_MODE_COOKIE(値"1")が既にある
 *     (SPA遷移中の維持。Cookie自体は秘密を持たない単なる状態フラグであり、
 *     httpOnly=falseでクライアントJSからも読めるため秘密を入れてはならない)
 * のいずれかを満たす場合にtrueを返す。
 * middleware.ts(Cookieの発行元)とresolveAnalyticsRequestContext.ts(isTestEventの決定)の
 * 両方がこの1関数だけを使うことで、判定基準の二重実装を防ぐ。
 */
export function isAuditModeRequest(request: Request): boolean {
  if (isAuditHeaderAuthorized(request.headers.get(AUDIT_MODE_HEADER))) return true;
  return readCookieValue(request, AUDIT_MODE_COOKIE) === "1";
}
