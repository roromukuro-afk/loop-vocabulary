/**
 * robots.txt のマッチング判定(純粋関数、サーバ起動不要)。
 * Google の robots.txt 実装(RFC 9309 + Google拡張)の仕様に沿って実装する:
 *
 *  - マッチングは URL の path + query 全体("?" 以降のクエリ文字列を含む)に対して
 *    行う。クエリ文字列は除去しない。
 *  - "*" は任意の文字列(0文字以上)にマッチする。
 *  - パターン末尾の "$" は「URL(path+query)の終端」を表す。そのため
 *    `Disallow: /road$` は `/road` にはマッチするが、`/road?x=1` のように
 *    その後ろに何か文字が続く場合はマッチしない(=ブロックされない)。
 *    例: `/*.php$` は `/file.php` にマッチするが `/file.php?id=1` にはマッチしない。
 *  - 複数ルールが一致する場合、パターン文字列が最も長い(=最も具体的な)ルールが
 *    優先される(Googleの「最長一致優先」)。長さが同じ場合は Allow が Disallow
 *    より優先される。
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
 * 与えられたURL(path、または "/road?x=1" のようにクエリ付き)が、rulesの下で
 * ブロックされるか判定する。クエリ文字列は除去せず、そのままマッチング対象にする
 * (Google仕様: "$" はクエリを含めた URL 全体の終端を意味する)。
 */
export function isPathBlocked(pathOrUrl, rules) {
  const target = pathOrUrl;
  let best = null; // { type, pattern, length }
  for (const rule of rules) {
    const regex = patternToRegex(rule.pattern);
    if (!regex.test(target)) continue;
    const length = rule.pattern.length;
    if (!best || length > best.length || (length === best.length && rule.type === "allow" && best.type !== "allow")) {
      best = { type: rule.type, pattern: rule.pattern, length };
    }
  }
  if (!best) return false; // 明示ルールが無ければデフォルトで許可
  return best.type === "disallow";
}
