import Link from "next/link";

interface Book {
  title: string;
  author: string;
  asin: string;
  price: string;
  label?: string;
}

interface AmazonBookProps {
  books: Book[];
  heading?: string;
}

const TAG = process.env.NEXT_PUBLIC_AMAZON_ASSOCIATE_TAG ?? "loop-vocabulary-22";

function bookUrl(asin: string) {
  return `https://www.amazon.co.jp/dp/${asin}/?tag=${TAG}`;
}

export function AmazonBookSection({ books, heading = "📚 おすすめ参考書（Amazon）" }: AmazonBookProps) {
  return (
    <section className="mt-10 bg-amber-50 border border-amber-200 rounded-2xl p-5">
      <h3 className="font-black text-amber-900 mb-4 text-base">{heading}</h3>
      <div className="space-y-3">
        {books.map((b) => (
          <Link
            key={b.asin}
            href={bookUrl(b.asin)}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="flex items-center gap-3 bg-white rounded-xl border border-amber-100 p-3 hover:shadow-md transition-shadow group"
          >
            {/* Amazon ロゴ代わりの書籍アイコン */}
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 text-xl">
              📖
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-navy-800 text-sm leading-tight group-hover:text-amber-700 transition-colors line-clamp-2">
                {b.title}
              </div>
              <div className="text-[11px] text-navy-500 mt-0.5">{b.author}</div>
              {b.label && (
                <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 bg-amber-200 text-amber-800 rounded font-bold">
                  {b.label}
                </span>
              )}
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-bold text-navy-700">{b.price}</div>
              <div className="text-[10px] text-amber-600 mt-0.5">Amazon →</div>
            </div>
          </Link>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-amber-700">
        ※ Amazonアソシエイトプログラムを通じた広告リンクです。購入いただいた際、当サービスに一部の収益が入ります。
      </p>
    </section>
  );
}
