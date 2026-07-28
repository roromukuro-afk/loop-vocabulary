/**
 * robots.txt のマッチング判定(純粋関数、サーバ起動不要)。
 * Google の robots.txt 実装(RFC 9309 + Google拡張)の仕様に沿って実装する:
 *
 *  - パスの比較は "?" より前のパス部分のみで行う(クエリ文字列は無視する)。
 *    そのため `Disallow: /road$` は `/road` だけでなく `/road?x=1` もブロックする
 *    (パス部分はどちらも "/road" で同一)。
 *  - "*" は任意の文字列(0文字以上)にマッチする。
 *  - パターン末尾の "$" は「パスの終端」を表す(そこで文字列が終わっている必要がある)。
 *  - 複数ルールが一致する場合、パターン文字列が最も長いルールが優先される
 *    (Googleの「最長一致優先」)。長さが同じ場合は Allow が Disallow より優先される。
 *
 * 使い方: node scripts/testing/e2e/robots-sitemap-collision.mjs
 */

/** robots.txt本文から "User-agent: *" グループの Allow/Disallow ルールだけを抽出する。 */
export function parseRobotsTxt(text) {
  const rules = [];
  let inWildcardGroup = false;
  for (const rawLine of text.split("\n")) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      inWildcardGroup = value === "*";
      continue;
    }
    if (!inWildcardGroup) continue;

    if (field === "allow") {
      rules.push({ type: "allow", pattern: value });
    } else if (field === "disallow") {
      if (value === "") continue; // "Disallow:" (空値) は「何もブロックしない」の意味
      rules.push({ type: "disallow", pattern: value });
    }
  }
  return rules;
}

function patternToRegex(pattern) {
  const anchored = pattern.endsWith("$");
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}${anchored ? "$" : ""}`);
}

/**
 * 与えられたパス(クエリ文字列を含んでいても良い)が、rulesの下でブロックされるか判定する。
 * pathOrUrl は "/road" のようなパス、または "/road?x=1" のようにクエリ付きでも良い
 * (マッチングは "?" より前の部分だけで行う)。
 */
export function isPathBlocked(pathOrUrl, rules) {
  const path = pathOrUrl.split("?")[0];
  let best = null; // { type, pattern, length }
  for (const rule of rules) {
    const regex = patternToRegex(rule.pattern);
    if (!regex.test(path)) continue;
    const length = rule.pattern.length;
    if (!best || length > best.length || (length === best.length && rule.type === "allow" && best.type !== "allow")) {
      best = { type: rule.type, pattern: rule.pattern, length };
    }
  }
  if (!best) return false; // 明示ルールが無ければデフォルトで許可
  return best.type === "disallow";
}
