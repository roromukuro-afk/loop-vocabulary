import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  /** 省略時は現在ページ扱い（リンクなし・aria-current="page"） */
  href?: string;
};

type BreadcrumbProps = {
  items: BreadcrumbItem[];
  /**
   * "light": 明るい背景(#f7f9fc等)の上で使う通常配色（既定）
   * "dark": ネイビーのグラデーションヒーローなど、暗い背景の上で使う配色
   */
  variant?: "light" | "dark";
  className?: string;
};

/**
 * サイト全体で共通利用する、視覚的に見えるパンくずリスト。
 *
 * 既存の各ページはBreadcrumbList構造化データ(JSON-LD)をscriptタグで
 * 出力しているが、画面上に人間が見てクリックできるパンくずUIが存在しなかった
 * (GROWTH_SEO_MASTER_CHECKLIST.md P-02)。このコンポーネントはその視覚的な
 * パンくずUIのみを担当し、JSON-LD生成はこれまで通り各ページ側で行う
 * （重複実装しない）。呼び出し側は、そのページが出力しているBreadcrumbList
 * JSON-LDのitemListElementと、labelおよび順序が一致するitemsを渡すこと。
 */
export function Breadcrumb({ items, variant = "light", className = "" }: BreadcrumbProps) {
  if (!items || items.length === 0) return null;

  const isDark = variant === "dark";
  const linkClass = isDark
    ? "text-navy-300 hover:text-white transition-colors"
    : "text-navy-500 hover:text-sky-700 transition-colors";
  const currentClass = isDark ? "text-white font-semibold" : "text-navy-800 font-semibold";
  const separatorClass = isDark ? "text-navy-500" : "text-navy-300";

  return (
    <nav aria-label="breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden="true" className={separatorClass}>
                  /
                </span>
              )}
              {item.href && !isLast ? (
                <Link href={item.href} className={linkClass}>
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined} className={isLast ? currentClass : linkClass}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
