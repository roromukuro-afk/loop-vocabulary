import { after } from "next/server";
import { submitUrlsToIndexNow } from "./submit";
import { normalizeSiteUrl } from "@/lib/seo/siteUrl";

export type NotifyIndexNowOptions = {
  /**
   * trueの場合、直近10分デデュープを無視して必ず送信を試みる。公開⇄非公開の反転・削除
   * 通知など、"内容の変化ではなく状態そのものが変わった"ことを伝える通知にのみ使うこと。
   * 通常の同一URLへの内容更新通知(例: 教材への単語追加)ではfalse(デフォルト)のままにし、
   * 短時間の連続更新をデデュープさせる(submit.tsのSubmitIndexNowOptions参照)。
   */
  bypassDedupe?: boolean;
};

/**
 * APIルートのレスポンス送信後に、ページ単位でIndexNowへ即時通知するための薄いラッパー。
 * Next.js 15の`after()`(Vercelサーバーレス関数のレスポンス送信後もインスタンスの
 * 実行を継続させる仕組み)を使うことで、クライアントへのレスポンスを一切遅延させずに
 * (=呼び出し元の書き込み処理を絶対に壊さずに)、確実に送信処理まで完了させる。
 *
 * `submitUrlsToIndexNow`自体がthrowしない設計だが、`after()`内の未処理rejectionが
 * プロセスレベルの警告ログに出るのを避けるため念のため`.catch()`する。
 *
 * @param paths サイトルートからの絶対パス(例: "/materials/xxx")の配列。空配列・重複は
 *   呼び出し元で気にしなくてよい(ここで正規化・重複排除・空スキップを行う)。
 */
export function notifyIndexNowAfterResponse(paths: string[], opts: NotifyIndexNowOptions = {}): void {
  const base = normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
  const urls = [...new Set(paths.filter((p): p is string => typeof p === "string" && p.length > 0))].map(
    (p) => `${base}${p}`,
  );
  if (urls.length === 0) return;

  after(() => {
    submitUrlsToIndexNow(urls, { bypassDedupe: opts.bypassDedupe === true }).catch(() => {
      // submitUrlsToIndexNowは仕様上throwしないため通常到達しない安全網
    });
  });
}
