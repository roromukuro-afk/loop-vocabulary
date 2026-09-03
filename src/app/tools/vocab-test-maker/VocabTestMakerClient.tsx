"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createClient } from "@/lib/supabase/client";
import { shuffle } from "@/lib/utils/shuffle";
import { getCurrentTrafficSourceAttribution, trackEvent } from "@/lib/analytics/track";
import { ShareUrlButton } from "@/components/share/ShareUrlButton";
import { parsePastedWords, MAX_WORDS, MAX_FIELD_LENGTH } from "@/lib/vocabTest/parsePastedWords";
import type { ParseWarning } from "@/lib/vocabTest/parsePastedWords";
import { renderTestHtml, MIN_CHOICE_ROWS, countUniqueAnswers, findConflictingPrompt } from "@/lib/vocabTest/renderTestHtml";
import type { AnswerMode, Direction, Format, Order, Row } from "@/lib/vocabTest/types";

// このpublic toolに固有のQR遷移先。既存 /pdf の teacher_pdf UTM とは分離する
// (別導線として計測するため)。遷移先はこのツール自身
// (/tools/vocab-test-maker)を選んだ — 印刷物を受け取った人(生徒等、作成者と
// 別人であることが多い)が「これは何で作られたか」を最も自然にたどれる先であり、
// 特定の単語データを持たない匿名生成物からでも、次に自分の単語で同じツールを
// 使うという行動へ直接つながるため(PR body参照)。
const QR_TARGET_URL = "https://loop-vocabulary.app/tools/vocab-test-maker?utm_source=vocab_test_pdf&utm_medium=offline&utm_campaign=public_vocab_test_maker";

// SNS共有CTA(Issue #98)で渡す固定値。共有するのはこのツール自身の正規URLのみで、
// 貼り付けた単語・生成結果・sessionStorageの内容等は絶対に含めない
// (URL queryへの語彙prefillも行わない)。
const SHARE_URL = "https://loop-vocabulary.app/tools/vocab-test-maker";
const SHARE_TITLE = "英単語テスト作成【無料・登録不要】";
const SHARE_TEXT = "自分の単語リストから、登録不要ですぐ英単語の小テストを作れます。";
// ShareUrlButton(Web Share API/クリップボードコピー)経由の流入計測用。
// navigator.share()の遷移先はOS側のシートに委ねられ実際にどこへ渡ったか分からないため、
// utm_mediumは特定チャネルを騙らず汎用の"share"にとどめる。
const SHARE_URL_TAGGED = `${SHARE_URL}?utm_source=vocab_test_maker&utm_medium=share&utm_campaign=tool_share`;
// X(旧Twitter)共有ボタン専用。遷移先が確実にXであることが分かっているため
// utm_source=x&utm_medium=socialで個別に計測する。
const X_SHARE_URL_TAGGED = `${SHARE_URL}?utm_source=x&utm_medium=social&utm_campaign=vocab_test_maker_share`;

const PENDING_KEY = "lv_pending_vocab_test";
const PENDING_VERSION = 1;
const PENDING_TTL_MS = 30 * 60 * 1000; // 30分。signup/loginの往復を待つのに十分な猶予。
const PENDING_MAX_BYTES = 50_000; // 100語×200文字×2フィールドの理論上限より十分大きい安全側の上限。

type PendingPayload = { v: number; savedAt: string; rows: Row[] };

function readPendingPayload(): Row[] | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingPayload>;
    if (parsed.v !== PENDING_VERSION || typeof parsed.savedAt !== "string" || !Array.isArray(parsed.rows)) {
      sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    const age = Date.now() - Date.parse(parsed.savedAt);
    if (!Number.isFinite(age) || age < 0 || age > PENDING_TTL_MS) {
      sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    // 復元時も未信用のまま再検証する(sessionStorageの内容を直接信用しない)。
    const rows = parsed.rows.filter(
      (r): r is Row => !!r && typeof r.word === "string" && typeof r.meaning === "string" &&
        r.word.length > 0 && r.word.length <= MAX_FIELD_LENGTH &&
        r.meaning.length > 0 && r.meaning.length <= MAX_FIELD_LENGTH
    ).slice(0, MAX_WORDS);
    return rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}

function writePendingPayload(rows: Row[]): boolean {
  try {
    const payload: PendingPayload = { v: PENDING_VERSION, savedAt: new Date().toISOString(), rows };
    const serialized = JSON.stringify(payload);
    if (serialized.length > PENDING_MAX_BYTES) return false;
    sessionStorage.setItem(PENDING_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

function clearPendingPayload() {
  try { sessionStorage.removeItem(PENDING_KEY); } catch { /* noop */ }
}

// スキップされた行の理由を種類ごとに数えて具体的に示す(「意味の欠落・200文字超過・
// 重複・上限超過のいずれか」という一律の羅列だと、利用者は自分の入力の何が悪かったのか
// 分からず次に何を直せばよいか判断できない。次に何をすればよいか分かる日本語にする)。
function summarizeWarnings(warnings: ParseWarning[]): string {
  const counts = { missing_field: 0, overlength: 0, duplicate: 0, over_limit: 0 };
  for (const w of warnings) counts[w.type]++;
  const parts: string[] = [];
  if (counts.missing_field > 0) parts.push(`意味または英単語の欠落: ${counts.missing_field}行`);
  if (counts.overlength > 0) parts.push(`1フィールド${MAX_FIELD_LENGTH}文字超過: ${counts.overlength}行`);
  if (counts.duplicate > 0) parts.push(`重複: ${counts.duplicate}行`);
  if (counts.over_limit > 0) parts.push(`${MAX_WORDS}語上限超過: ${counts.over_limit}行`);
  return `${warnings.length}行はスキップされました(${parts.join("、")})`;
}

export function VocabTestMakerClient() {
  const [text, setText] = useState("");
  const [direction, setDirection] = useState<Direction>("en2ja");
  const [format, setFormat] = useState<Format>("write");
  const [order, setOrder] = useState<Order>("random");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("separate");
  const [generatedRows, setGeneratedRows] = useState<Row[] | null>(null);
  const [parseMsg, setParseMsg] = useState<string | null>(null);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ kind: "ok" | "error"; text: string; wordbookId?: string } | null>(null);
  const [restoring, setRestoring] = useState(false);
  const savingRef = useRef(false);
  const autoRestoreAttemptedRef = useRef(false);

  useEffect(() => {
    trackEvent("vocab_test_maker_page_viewed", {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      setIsAuthed(!!user);

      // 認証済みの状態でこのページへ戻ってきた場合のみ、pending payloadを自動保存する。
      if (user && !autoRestoreAttemptedRef.current) {
        autoRestoreAttemptedRef.current = true;
        const rows = readPendingPayload();
        if (rows && rows.length > 0) {
          setRestoring(true);
          setText(rows.map((r) => `${r.word},${r.meaning}`).join("\n"));
          // saveMsgは生成後CTAブロック({generatedRows && ...})の中でのみ表示されるため、
          // 自動保存の結果を表示するにはgeneratedRowsも設定する必要がある
          // (このタイミングでは通常のgenerate操作は経ていないが、表示上は同じ枠を使う)。
          setGeneratedRows(rows);
          // 自動保存中もCTAが操作可能なままだと、この保存の完了前に手動でCTAを押されて
          // 二重保存(単語帳・単語の重複作成)が起きる。手動保存(handleSrsCta)と同じ
          // ロックを使い、CTAのdisabled判定にも使われるrestoringと合わせて防ぐ
          // (Codexレビュー指摘対応)。
          savingRef.current = true;
          const res = await saveToWordbook(rows);
          savingRef.current = false;
          setRestoring(false);
          if (res.ok) {
            // 保存に成功した場合のみ削除する。失敗時に無条件で消してしまうと、
            // ここまでの唯一の永続コピー(sessionStorage)が失われ、ユーザーが
            // このタイミングでページを離脱・再読み込みした場合に単語を
            // 二度と復元できなくなる(Codexレビュー指摘対応)。
            clearPendingPayload();
            setSaveMsg({ kind: "ok", text: `さきほど貼り付けた${rows.length}語をLoopの単語帳に保存しました。`, wordbookId: res.wordbookId });
          } else {
            setSaveMsg({ kind: "error", text: "自動保存に失敗しました。お手数ですが、もう一度「Loopで覚える」をお試しください。" });
          }
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGenerate = async () => {
    setGenMsg(null);
    setSaveMsg(null);
    const { rows, warnings, totalNonBlankLines } = parsePastedWords(text);

    if (rows.length === 0) {
      const reason = totalNonBlankLines === 0 ? "empty" : "all_invalid";
      trackEvent("vocab_test_maker_parse_failed", { reason });
      setParseMsg(
        totalNonBlankLines === 0
          ? "単語を貼り付けてください(例: apple,りんご)"
          : "有効な行がありませんでした。「英単語,日本語訳」の形式で、1行に1語ずつ貼り付けてください。"
      );
      setGeneratedRows(null);
      return;
    }
    setParseMsg(warnings.length > 0 ? summarizeWarnings(warnings) : null);

    // 4択は正解1つ+ダミー3つの計4選択肢が要るため、「答え側の値」がdistinctで
    // 4種類未満なら生成させない(renderTestHtml側もfail-closedだが、ここで先に
    // 分かりやすいエラーを表示する。row数ではなく答え側の値の種類数で判定する —
    // 例えば異なる単語が複数同じ意味を持つ場合、row数は足りていても選択肢として
    // 使える答えの種類が足りないことがあるため)。
    const uniqueAnswers = countUniqueAnswers(rows, direction);
    if (format === "choice" && uniqueAnswers < MIN_CHOICE_ROWS) {
      setGenMsg(`4択形式には、答えの種類が異なる組み合わせが最低${MIN_CHOICE_ROWS}種類必要です(現在${uniqueAnswers}種類)。「出題形式」を「記述」に変更するか、単語を追加してください。`);
      setGeneratedRows(null);
      return;
    }
    // 同じ単語(prompt)が複数行にまたがって異なる意味を持つ場合、4択では正解が
    // 一意に決まらず、片方の意味がもう片方の問題のダミー選択肢に紛れ込んで
    // 採点不能になる(Codexレビュー指摘対応)。
    const conflictingPrompt = format === "choice" ? findConflictingPrompt(rows, direction) : null;
    if (conflictingPrompt !== null) {
      setGenMsg(`4択形式には使えない組み合わせがあります。「${conflictingPrompt}」に複数の異なる意味が登録されているため、正解を一意に決められません。重複する行を1つにまとめるか、「出題形式」を「記述」に変更してください。`);
      setGeneratedRows(null);
      return;
    }

    const orderedRows = order === "random" ? shuffle(rows) : rows;
    setGeneratedRows(orderedRows);

    // 印刷ウィンドウを実際に開けた(=利用者がテストを受け取れた)場合のみ
    // "generated"を計測する。popup blocked等で失敗した場合まで成功扱いで
    // 計測すると、この獲得施策の転換率指標が実態より良く見えてしまう
    // (Codexレビュー指摘対応)。
    const opened = await openPrintWindow(orderedRows);
    if (opened) {
      trackEvent("vocab_test_maker_generated", {
        row_count: orderedRows.length,
        direction,
        format,
        randomized: order === "random",
        answer_mode: answerMode,
      });
    }
  };

  const openPrintWindow = async (rows: Row[]): Promise<boolean> => {
    // window.open()はclickのuser activationがasync境界(await)を跨ぐと失効し、
    // 後から呼ぶとブラウザにブロックされることがある。そのため、QR生成等の
    // await より前に同期的にwindow.openを呼び、後から内容を書き込む
    // (Codexレビュー指摘対応)。
    const w = window.open("", "_blank");
    if (!w) {
      setGenMsg("ポップアップがブロックされました。ブラウザの設定でこのサイトのポップアップを許可してください。");
      return false;
    }

    const qrDataUrl = await QRCode.toDataURL(QR_TARGET_URL, {
      width: 88,
      margin: 0,
      color: { dark: "#1a2a4a", light: "#ffffff" },
    }).catch(() => null);

    let html: string;
    try {
      html = renderTestHtml({
        rows,
        direction,
        format,
        columns: 1,
        answerMode,
        title: "英単語",
        attribution: null,
        qrDataUrl,
      });
    } catch (e) {
      // 呼び出し前validation(上のhandleGenerate内チェック)をすり抜けた場合の保険
      // (render関数自身のfail-closedガード。通常はここに到達しない)。render関数側の
      // エラーメッセージ(理由別に具体的)をそのまま使い、想定外の例外の場合のみ
      // 汎用メッセージにfall backする。既に開いてしまった空タブは、内容を書き込まず
      // そのまま残すと利用者が混乱するため閉じる。
      w.close();
      setGenMsg(
        e instanceof Error && e.message
          ? e.message
          : `4択形式には、答えの種類が異なる組み合わせが最低${MIN_CHOICE_ROWS}種類必要です。「出題形式」を「記述」に変更するか、単語を追加してください。`
      );
      setGeneratedRows(null);
      return false;
    }
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
    return true;
  };

  const saveToWordbook = async (rows: Row[]): Promise<{ ok: boolean; wordbookId?: string }> => {
    try {
      // lv_aid Cookieは複数タブで共有されるため、保存操作を開始したタブ自身の
      // source/campaignもPOSTへ同梱する。単語データ以外の自由記述やPIIは含めない。
      const attribution = getCurrentTrafficSourceAttribution();
      const res = await fetch("/api/tools/vocab-test-maker/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ words: rows, attribution }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) return { ok: false };
      return { ok: true, wordbookId: json.wordbook_id };
    } catch {
      return { ok: false };
    }
  };

  // X intent linkを新規タブで開く操作そのものをshare_invokedとして記録する。
  // window.open()の戻り値は実際に投稿されたかを示さない(ポップアップブロック時も
  // 呼び出しは成功したように見える)ため、ShareUrlButtonと同様「共有操作を開始した」
  // 事実のみを表す(投稿完了/share_completedは計測しない)。
  const handleXShare = () => {
    const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(X_SHARE_URL_TAGGED)}`;
    window.open(intentUrl, "_blank", "noopener,noreferrer");
    trackEvent("vocab_test_maker_share_invoked", { method: "x_intent" });
  };

  const handleSrsCta = async () => {
    if (!generatedRows || generatedRows.length === 0) return;
    if (savingRef.current) return;
    // 認証状態の判定(getUser())がまだ解決していない間はボタン自体をdisabledにしているが、
    // 呼び出し側のUI状態だけに頼らず、ここでも独立してfail-closedにする(すでに
    // ログイン済みのユーザーが、isAuthedがnullのままのタイミングでこの関数を呼んでしまい、
    // 未認証分岐(/signupへ誘導)に誤って入ることを防ぐ)。
    if (isAuthed === null) return;
    // 保存成功後にもう一度呼ばれると同じ単語で2件目のwordbookが作られてしまうため、
    // ボタンのdisabled状態だけに頼らずここでも独立して防ぐ(Codexレビュー指摘対応)。
    if (saveMsg?.kind === "ok") return;
    savingRef.current = true;
    setSaveMsg(null);

    trackEvent("vocab_test_maker_srs_cta_clicked", { authenticated: !!isAuthed });

    if (isAuthed) {
      setSaveBusy(true);
      const res = await saveToWordbook(generatedRows);
      setSaveBusy(false);
      savingRef.current = false;
      if (res.ok) {
        setSaveMsg({ kind: "ok", text: `${generatedRows.length}語をLoopの単語帳として保存しました。`, wordbookId: res.wordbookId });
      } else {
        setSaveMsg({ kind: "error", text: "保存に失敗しました。もう一度お試しください。" });
      }
      return;
    }

    // 未認証: URL/クエリパラメータには絶対に載せない。sessionStorageのみ(同一tab限定)。
    const wrote = writePendingPayload(generatedRows);
    savingRef.current = false;
    if (!wrote) {
      setSaveMsg({ kind: "error", text: "単語数が多すぎるため一時保存できませんでした。新規登録後、もう一度貼り付けてください。" });
      return;
    }
    window.location.href = `/signup?next=${encodeURIComponent("/tools/vocab-test-maker")}`;
  };

  return (
    <div className="min-h-dvh bg-[#f7f9fc] pb-16">
      <div className="bg-gradient-to-br from-navy-800 to-navy-950 px-5 pt-12 pb-10 text-white text-center">
        <div className="max-w-2xl mx-auto">
          <div className="text-[10px] font-bold uppercase tracking-widest text-sky-300 mb-3">Loop Vocabulary</div>
          <h1 className="text-2xl font-black leading-tight">英単語テストを無料で作成</h1>
          <p className="mt-2 text-sm text-navy-300 max-w-md mx-auto">
            自分の単語リストから、登録不要ですぐ小テストを作れます。印刷した後は、同じ単語をLoopの復習学習へ引き継げます。
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 mt-6 space-y-4">
        {restoring && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            さきほど貼り付けた単語をLoopの単語帳に保存しています…
          </div>
        )}

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <label htmlFor="vocab-test-paste" className="block text-sm font-bold text-navy-800 mb-1">
            英単語と日本語訳を貼り付け
          </label>
          <p className="text-xs text-navy-400 mb-2">
            1行に1語、「英単語,日本語訳」の形式で貼り付けてください(タブ区切りも使えます)。最大{MAX_WORDS}語。
          </p>
          <pre className="text-[11px] bg-navy-50 text-navy-500 rounded-lg p-2 mb-2 whitespace-pre-wrap">{"apple,りんご\nbeautiful,美しい\nenvironment,環境"}</pre>
          <textarea
            id="vocab-test-paste"
            data-testid="vocab-test-paste-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-navy-200 p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sky-300"
            placeholder={"apple,りんご\nbeautiful,美しい"}
          />
          {parseMsg && <p className="mt-2 text-xs text-amber-700" role="status">{parseMsg}</p>}
        </div>

        <div className="bg-white rounded-2xl border border-navy-100 shadow-sm p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="出題方向">
              <Select value={direction} onChange={(e) => setDirection(e.target.value as Direction)}>
                <option value="en2ja">英 → 日</option>
                <option value="ja2en">日 → 英</option>
              </Select>
            </Field>
            <Field label="解答">
              <Select value={answerMode} onChange={(e) => setAnswerMode(e.target.value as AnswerMode)}>
                <option value="separate">別紙(解答用紙を分離)</option>
                <option value="inline">同ページ末尾に解答</option>
                <option value="none">なし(問題のみ)</option>
              </Select>
            </Field>
          </div>
          <details className="mt-3">
            <summary className="text-xs text-navy-500 cursor-pointer select-none">詳細設定</summary>
            <div className="grid gap-3 sm:grid-cols-2 mt-3">
              <Field label="出題形式">
                <Select value={format} onChange={(e) => setFormat(e.target.value as Format)}>
                  <option value="write">記述</option>
                  <option value="choice">4 択</option>
                </Select>
              </Field>
              <Field label="順番">
                <Select value={order} onChange={(e) => setOrder(e.target.value as Order)}>
                  <option value="random">ランダム</option>
                  <option value="sequential">貼り付けた順番</option>
                </Select>
              </Field>
            </div>
          </details>
          <Button
            onClick={handleGenerate}
            disabled={text.trim().length === 0}
            size="lg"
            fullWidth
            data-testid="vocab-test-generate-button"
            className="mt-4"
          >
            テストを作成する
          </Button>
          <p className="text-[11px] text-navy-400 mt-2">
            別タブで印刷プレビューが開きます。ブラウザの印刷画面から「PDFとして保存」を選ぶと、PDFとして保存できます。ログイン・登録は不要です。
          </p>
          {genMsg && <p className="mt-2 text-sm text-red-600" role="alert">{genMsg}</p>}
        </div>

        {generatedRows && generatedRows.length > 0 && (
          <div className="bg-gradient-to-r from-navy-700 to-navy-900 rounded-2xl p-5 text-white text-center">
            <div className="font-black text-base">この単語をLoopで覚える</div>
            <p className="text-xs text-navy-300 mt-1">
              テストにした{generatedRows.length}語を、そのままLoop Vocabularyの復習(SRS)へ引き継げます。
            </p>
            <div className="mt-4">
              <button
                onClick={handleSrsCta}
                disabled={saveBusy || isAuthed === null || restoring || saveMsg?.kind === "ok"}
                data-testid="vocab-test-srs-cta"
                className="px-6 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors disabled:opacity-60"
              >
                {saveBusy || restoring
                  ? "保存中..."
                  : isAuthed === null
                  ? "確認中..."
                  : saveMsg?.kind === "ok"
                  ? "保存済み"
                  : "Loopで覚える →"}
              </button>
            </div>
            {saveMsg && (
              <div role={saveMsg.kind === "ok" ? "status" : "alert"} className={`mt-3 text-sm ${saveMsg.kind === "ok" ? "text-emerald-300" : "text-red-300"}`}>
                {saveMsg.text}
                {saveMsg.kind === "ok" && saveMsg.wordbookId && (
                  <>
                    {" "}
                    <Link href={`/wordbooks/${saveMsg.wordbookId}`} className="underline text-white">
                      単語帳を開く →
                    </Link>
                  </>
                )}
              </div>
            )}
            <div className="mt-5 pt-4 border-t border-white/10">
              <p className="text-[11px] text-navy-300 mb-2">このツールが役に立ったら、友だちや同僚にも教えてください</p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <ShareUrlButton
                  url={SHARE_URL_TAGGED}
                  title={SHARE_TITLE}
                  text={SHARE_TEXT}
                  label="🔗 このツールをシェア"
                  onShareInvoked={(method) => trackEvent("vocab_test_maker_share_invoked", { method })}
                />
                <button
                  type="button"
                  onClick={handleXShare}
                  data-testid="vocab-test-x-share-button"
                  className="px-5 py-2.5 rounded-xl bg-white text-navy-800 font-bold text-sm hover:bg-navy-50 transition-colors"
                >
                  𝕏でシェア
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="text-center">
          <Link href="/tools" className="text-sm text-navy-500 underline">← ツール一覧に戻る</Link>
        </div>
      </div>
    </div>
  );
}

function shuffleRows(rows: Row[]): Row[] {
  const a = [...rows];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
