// 明示的な.ts拡張子の理由はtestEventClassification.ts冒頭のコメント参照。
import { AUDIT_MODE_HEADER, AUDIT_MODE_COOKIE_MAX_AGE_SECONDS } from "./auditMode.ts";

/**
 * 監査モード(analytics除外・広告抑止)の起動判定のうち、秘密トークン照合を含む
 * サーバー専用ロジック。middleware.ts・route handler(resolveAnalyticsRequestContext.ts
 * 経由)からのみimportすること。
 *
 * ./auditMode.ts はクライアントバンドルにも含まれる(layout.tsx・AdSenseLoader.tsxが
 * 直接importする)ため、node:crypto・process.env.LV_AUDIT_TOKEN(秘密)・
 * AUDIT_PROOF_COOKIE(このファイルだけが知っていればよいCookie名)はこちらのファイルにのみ
 * 置く(意図的な分離。auditMode.tsのコメント参照)。
 *
 * オーナー指摘対応(セキュリティ、Issue #136是正の再強化): 以前は AUDIT_MODE_HEADER の値が
 * 固定文字列 "1" であれば誰でも監査モードを起動できた。x-lv-e2e-test はブラウザからも
 * 自由に送信できるヘッダーであり、認可目的でなくても「攻撃者が広告収益・計測データを
 * 任意に抑止できる」計測品質上の脆弱性だった。このためヘッダー値そのものを、
 * server-onlyの環境変数と突き合わせる秘密トークンに置き換える
 * (ヘッダー名は変更しない。監査スクリプト側だけが値を知っていればよい)。
 *
 * オーナー指摘対応(セキュリティ、2026-09-01、Cookie側の同種の脆弱性、2回にわたり発見):
 * 監査状態の維持用Cookieも、最初はhttpOnly=falseの固定文字列"1"だった(client JSが
 * document.cookie経由で秘密トークンなしに自称できた)。次にHMAC署名値へ変更したが、
 * 署名対象が固定メッセージだったため「署名値自体は現在のLV_AUDIT_TOKENが変わらない限り
 * 永久に有効」という問題が残っていた(監査ブラウザから一度Cookie値を取得すれば、
 * その値を任意の有効期限で自分のCookieとして再設定し、無期限に再利用できてしまう)。
 * 対策: Cookie値を「iat(発行時刻)・exp(有効期限)・nonce」を含むpayloadへの署名(=期限付き
 * proof)へ変更する(createSignedAuditProof/verifySignedAuditProof参照)。かつこのproof
 * Cookie(AUDIT_PROOF_COOKIE)はhttpOnly=trueにし、client JavaScriptから一切読めなくする
 * (client側の広告抑制表示にはserver判定を一切左右しない別のCookie、
 * auditMode.tsのAUDIT_MODE_UI_COOKIEを使う)。
 *
 * - clientへ絶対に公開しない: このファイルはmiddleware.ts・route handlerからのみ
 *   importされ、client component("use client")からは一切importされない
 *   (importするとprocess.env.LV_AUDIT_TOKENの読み取りごとクライアントバンドルへ
 *   混入しうるため、client component側は./auditMode.tsだけを使う設計にしている)。
 *   node:crypto等のNode専用APIは意図的に使わない: middleware.tsはNext.jsの既定では
 *   Edge Runtimeで動作し、Edge RuntimeはNode専用API(node:crypto含む)をサポートしない
 *   ため、下のsafeEqual()はNode/Edge/ブラウザのどこでも動く素のJavaScriptだけで
 *   タイミング攻撃耐性のある比較を実装している。HMAC署名・base64エンコード・乱数生成は
 *   すべてWeb標準API(globalThis.crypto.subtle・btoa/atob・crypto.randomUUID、
 *   いずれもEdge Runtimeで標準提供)だけを使う。
 * - `NEXT_PUBLIC_` prefixも付けない(Next.jsはNEXT_PUBLIC_を持つ変数のみをクライアント
 *   バンドルへ埋め込む。この変数名にはprefixが無いため、ビルド時にクライアントJSへ
 *   絶対に混入しない)。
 * - CI/監査スクリプト側だけがこのヘッダーへ値を設定する(scripts/testing配下からのみ
 *   参照・送信され、アプリのクライアントコードは一切参照しない)。
 * - 未設定・不十分な長さ(誤って"1"のような短い値を設定してしまった場合を含む)は
 *   常に「一致しない」= 監査モードは絶対に起動しない、fail-closedで扱う。
 * - 秘密の値・proof Cookieの値自体はここでもどこでもログ・console出力しない。
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
 * 監査モードの維持に使う、server-onlyの署名付き期限付きproof Cookie名。
 * httpOnly=trueで発行するため、client JavaScriptからは一切読めない
 * (client側の広告抑制表示にはauditMode.tsのAUDIT_MODE_UI_COOKIEを使う。このファイルの
 * コメント冒頭参照)。
 */
export const AUDIT_PROOF_COOKIE = "lv_audit_proof";

// proofのpayload(JSON文字列)のbase64表現がこの長さを超える場合は、パース・検証を
// 一切行わず即座に拒否する(想定されるpayloadは100バイト未満。異常に巨大な値を
// 送りつけるクライアントに対する防御的な上限であり、実運用では絶対に到達しない)。
const MAX_PROOF_PAYLOAD_BASE64_LENGTH = 512;

// iatが「現在時刻より未来」であることを許容する最大の誤差(秒)。サーバー間の時刻ズレを
// 吸収しつつ、iatを大きく未来に偽装したproofを拒否する(異常なiatは即rejectという
// オーナー指摘の要件)。
const CLOCK_SKEW_TOLERANCE_SECONDS = 30;

interface AuditProofPayload {
  /** 発行時刻(unix seconds)。 */
  readonly iat: number;
  /** 有効期限(unix seconds)。 */
  readonly exp: number;
  /** 同じiat/expの組み合わせでもpayload全体・署名が予測しにくいようにするための乱数。 */
  readonly nonce: string;
}

function isValidAuditProofPayload(value: unknown): value is AuditProofPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.iat === "number" && Number.isFinite(v.iat)
    && typeof v.exp === "number" && Number.isFinite(v.exp)
    && typeof v.nonce === "string" && v.nonce.length > 0;
}

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
 * 現在設定されているLV_AUDIT_TOKENで、iat・exp・nonceを含む期限付きproofを新規発行する。
 * middleware.tsがAUDIT_MODE_HEADER認証成功時にだけ呼ぶ。トークン未設定ならnullを返す
 * (呼び出し側はCookieを一切セットしないこと)。呼ぶたびに新しいiat/exp/nonceを持つ
 * 新規のproofを発行する(アクティブな監査中はページ遷移のたびに呼ばれ、有効期限が
 * 実質的に延長される。auditMode.tsのAUDIT_MODE_COOKIE_MAX_AGE_SECONDS参照)。
 */
export async function createSignedAuditProof(): Promise<string | null> {
  const token = getConfiguredAuditToken();
  if (!token) return null;
  const now = Math.floor(Date.now() / 1000);
  const payload: AuditProofPayload = {
    iat: now,
    exp: now + AUDIT_MODE_COOKIE_MAX_AGE_SECONDS,
    nonce: crypto.randomUUID(),
  };
  const payloadBase64 = btoa(JSON.stringify(payload));
  const signature = await hmacSha256Hex(token, payloadBase64);
  return `${payloadBase64}.${signature}`;
}

/**
 * Cookie値(createSignedAuditProof()が発行した形式)を検証する。以下のいずれかに
 * 該当する場合は例外を投げず一律falseを返す(fail-closed): トークン未設定・Cookie
 * 未設定・形式不正(区切り"."が無い等)・巨大payload・base64/JSONとして解釈不能・
 * payloadの型不正・署名不一致・有効期限切れ(exp<現在時刻)・異常に未来のiat
 * (現在時刻+CLOCK_SKEW_TOLERANCE_SECONDSを超える)。
 */
async function isSignedAuditProofValid(cookieValue: string | null): Promise<boolean> {
  const token = getConfiguredAuditToken();
  if (!token || !cookieValue) return false;

  const dotIndex = cookieValue.indexOf(".");
  if (dotIndex === -1) return false;
  const payloadBase64 = cookieValue.slice(0, dotIndex);
  const signature = cookieValue.slice(dotIndex + 1);
  if (!payloadBase64 || !signature || payloadBase64.length > MAX_PROOF_PAYLOAD_BASE64_LENGTH) return false;

  // 署名検証をpayloadのデコード・パースより先に行う(不正な署名のリクエストに対して、
  // 無駄なJSONパース処理を実行しないため。署名検証自体はsafeEqualで定数時間)。
  const expectedSignature = await hmacSha256Hex(token, payloadBase64);
  if (!safeEqual(signature, expectedSignature)) return false;

  let payload: unknown;
  try {
    const decodedJson = atob(payloadBase64);
    if (decodedJson.length > MAX_PROOF_PAYLOAD_BASE64_LENGTH) return false;
    payload = JSON.parse(decodedJson);
  } catch {
    // 不正なBase64・不正なJSONのいずれも例外を外へ伝播させず、単に「無効」として扱う。
    return false;
  }
  if (!isValidAuditProofPayload(payload)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (payload.exp < nowSeconds) return false; // 有効期限切れ
  if (payload.iat > nowSeconds + CLOCK_SKEW_TOLERANCE_SECONDS) return false; // 異常に未来のiat
  return true;
}

/**
 * リクエストが監査モードの対象かどうかを判定する唯一の場所。
 * (1) AUDIT_MODE_HEADERが秘密トークンと一致する(監査スクリプトが明示的に開始)、または
 * (2) 直前のレスポンスでmiddleware.tsがセットしたAUDIT_PROOF_COOKIE(httpOnlyの署名付き
 *     期限付きproof。SPA遷移中の維持用)が現在のLV_AUDIT_TOKENに対して有効(署名一致・
 *     期限内・iatが異常に未来でない)
 * のいずれかを満たす場合にtrueを返す。client側のAUDIT_MODE_UI_COOKIE(auditMode.ts)は
 * ここでは一切参照しない(client側の表示上の判定専用であり、server側のtest-event判定を
 * 左右してはならない、というオーナー指摘の要件)。
 * middleware.ts(Cookieの発行元)とresolveAnalyticsRequestContext.ts(isTestEventの決定)の
 * 両方がこの1関数だけを使うことで、判定基準の二重実装を防ぐ。
 */
export async function isAuditModeRequest(request: Request): Promise<boolean> {
  if (isAuditHeaderAuthorized(request.headers.get(AUDIT_MODE_HEADER))) return true;
  return isSignedAuditProofValid(readCookieValue(request, AUDIT_PROOF_COOKIE));
}
