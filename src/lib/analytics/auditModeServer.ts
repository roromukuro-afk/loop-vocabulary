import { AUDIT_MODE_HEADER, AUDIT_MODE_COOKIE } from "./auditMode.ts";

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
 *   タイミング攻撃耐性のある比較を実装している。HMAC署名(computeSignedCookieValue)は
 *   Web Crypto API(globalThis.crypto.subtle、Edge Runtimeでも標準で使える)を使う。
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

// オーナー指摘対応(Codexレビュー、805ac98/84522f8に対する新規指摘、2026-09-01、重要):
// AUDIT_MODE_COOKIEは(layout.tsx・AdSenseLoader.tsxがdocument.cookieで直接読む必要が
// あるため)意図的にhttpOnly=falseで発行している。以前はこのCookieの値が固定文字列
// "1"であることだけを見ていたため、production上のどのクライアントJSも
// `document.cookie = "lv_audit=1; path=/"` を実行するだけで、秘密トークンを一切
// 知らずに監査モードを自称でき、AUDIT_MODE_HEADERの秘密トークン照合を導入した本来の
// 目的(計測データ汚染・広告抑止の任意発動を防ぐ)を無効化できてしまっていた。
//
// 対策: Cookieの値を「秘密トークンで署名した検証可能な値」に変更する。ヘッダーが
// 正しく認証された場合にのみサーバー(middleware.ts)がこの署名値を計算してCookieへ
// セットし、Cookieによる維持判定(このファイルのisAuditModeRequest)は「値が"1"か」
// ではなく「値が現在のLV_AUDIT_TOKENから導出した署名と一致するか」を確認する。
// 秘密トークン自体はCookie値に含めない(HMAC出力は一方向関数のため、Cookie値を
// 読めてもトークンを逆算できない)。Web Crypto API(globalThis.crypto.subtle)は
// Edge Runtime・Node・ブラウザのいずれでも利用できる標準APIで、非同期のみ提供する
// ため、isAuditModeRequest()を含む呼び出し経路(resolveAnalyticsRequestContext()・
// middleware.ts・8箇所のRoute Handler)がすべてasync化されている。
const AUDIT_COOKIE_SIGNATURE_MESSAGE = AUDIT_MODE_COOKIE;

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 現在設定されているLV_AUDIT_TOKENから、Cookieへセットすべき署名値を計算する。
 * middleware.tsがAUDIT_MODE_HEADER認証成功時にだけ呼ぶ。トークン未設定ならnullを返す
 * (呼び出し側はCookieを一切セットしないこと)。
 */
export async function getSignedAuditCookieValue(): Promise<string | null> {
  const token = getConfiguredAuditToken();
  if (!token) return null;
  return hmacSha256Hex(token, AUDIT_COOKIE_SIGNATURE_MESSAGE);
}

/** Cookie値が現在のLV_AUDIT_TOKENから導出した署名と一致するか(定数時間比較)。 */
async function isSignedAuditCookieValid(cookieValue: string | null): Promise<boolean> {
  const token = getConfiguredAuditToken();
  if (!token || !cookieValue) return false;
  const expected = await hmacSha256Hex(token, AUDIT_COOKIE_SIGNATURE_MESSAGE);
  return safeEqual(cookieValue, expected);
}

/**
 * リクエストが監査モードの対象かどうかを判定する唯一の場所。
 * (1) AUDIT_MODE_HEADERが秘密トークンと一致する(監査スクリプトが明示的に開始)、または
 * (2) 直前のレスポンスでmiddleware.tsがセットしたAUDIT_MODE_COOKIE(値は現在の
 *     LV_AUDIT_TOKENから導出した署名。SPA遷移中の維持用。Cookie自体はhttpOnly=falseで
 *     クライアントJSからも読めるが、値がHMAC署名のため秘密トークンを知らない限り
 *     有効な値を計算できない)が現在のトークンに対して有効な署名を持つ
 * のいずれかを満たす場合にtrueを返す。
 * middleware.ts(Cookieの発行元)とresolveAnalyticsRequestContext.ts(isTestEventの決定)の
 * 両方がこの1関数だけを使うことで、判定基準の二重実装を防ぐ。
 */
export async function isAuditModeRequest(request: Request): Promise<boolean> {
  if (isAuditHeaderAuthorized(request.headers.get(AUDIT_MODE_HEADER))) return true;
  return isSignedAuditCookieValid(readCookieValue(request, AUDIT_MODE_COOKIE));
}
