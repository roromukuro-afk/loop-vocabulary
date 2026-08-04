"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

type M = {
  id: string; title: string; publisher: string | null;
  level: string | null; exam_type: string | null;
  is_public: boolean; license_status: string;
  license_note: string | null; source_url: string | null;
};

const FALLBACK_MESSAGE = "操作に失敗しました。時間をおいてもう一度お試しください";

// bracket accessだとerror codeがconstructor/__proto__/toString等のprototype継承
// プロパティ名と一致した場合に文字列以外の値を拾ってしまうため、hasOwnPropertyで
// own propertyだけに限定する(inはprototype chainを含むため使わない)。
function resolveErrorMessage(messages: Readonly<Record<string, string>>, code: string | null): string {
  if (code && Object.prototype.hasOwnProperty.call(messages, code)) {
    return messages[code];
  }
  return FALLBACK_MESSAGE;
}

const COMMON_ERROR_MESSAGES: Record<string, string> = {
  unauthorized: "ログイン状態を確認して、もう一度お試しください",
  forbidden: "管理者権限を確認して、もう一度お試しください",
  invalid_body: "入力内容を確認してください",
  not_found: "対象の教材が見つかりません",
};
const CREATE_ERROR_MESSAGES: Record<string, string> = {
  ...COMMON_ERROR_MESSAGES,
  insert_failed: "教材の登録に失敗しました",
};
const TOGGLE_ERROR_MESSAGES: Record<string, string> = {
  ...COMMON_ERROR_MESSAGES,
  update_failed: "公開設定の更新に失敗しました",
};
const STATUS_ERROR_MESSAGES: Record<string, string> = {
  ...COMMON_ERROR_MESSAGES,
  update_failed: "許諾ステータスの更新に失敗しました",
};
const NOTE_ERROR_MESSAGES: Record<string, string> = {
  ...COMMON_ERROR_MESSAGES,
  update_failed: "許諾メモの保存に失敗しました",
};
const DELETE_ERROR_MESSAGES: Record<string, string> = {
  ...COMMON_ERROR_MESSAGES,
  fetch_failed: "教材の削除に失敗しました",
  delete_failed: "教材の削除に失敗しました",
};

type ApiResult = { ok: true; body: Record<string, unknown> | null } | { ok: false; code: string | null };

// 全mutationで共通のfetch+解析ヘルパー。network例外・非JSON応答・HTTP非2xxのいずれも、
// 生のエラー内容(APIのdetailやSupabaseの生メッセージ)を漏らさず、呼び出し側へ
// 「成功bodyがあるか」か「(あれば)既知のerror code」だけを返す。
async function callMaterialsApi(path: string, init: RequestInit): Promise<ApiResult> {
  let res: Response;
  try {
    res = await fetch(path, init);
  } catch {
    return { ok: false, code: null };
  }
  const json: unknown = await res.json().catch(() => null);
  const body = json && typeof json === "object" ? (json as Record<string, unknown>) : null;
  if (!res.ok) {
    const code = body && typeof body.error === "string" ? body.error : null;
    return { ok: false, code };
  }
  return { ok: true, body };
}

const EMPTY_DRAFT = {
  title: "", publisher: "", author: "", description: "",
  level: "", exam_type: "", source_url: "",
  license_status: "pending", license_note: "", is_public: false,
};

export function MaterialAdminTable({ materials }: { materials: M[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // 二重送信防止は同期的なrefで持つ(state更新は次のレンダーまで反映されないため)。
  // 操作単位のkey(create / toggle:id / status:id / note:id / delete:id)で、
  // 異なる教材IDの操作を誤って同じpending扱いにしない。
  const pendingActionsRef = useRef<Set<string>>(new Set());
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());

  function beginAction(key: string): boolean {
    if (pendingActionsRef.current.has(key)) return false;
    pendingActionsRef.current.add(key);
    setPendingActions(new Set(pendingActionsRef.current));
    setStatusMessage(null);
    setErrorMessage(null);
    return true;
  }
  function endAction(key: string) {
    pendingActionsRef.current.delete(key);
    setPendingActions(new Set(pendingActionsRef.current));
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!beginAction("create")) return;
    const result = await callMaterialsApi("/api/admin/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    endAction("create");
    if (!result.ok) {
      setErrorMessage(resolveErrorMessage(CREATE_ERROR_MESSAGES, result.code));
      return;
    }
    setStatusMessage("教材を登録しました");
    setCreating(false);
    setDraft(EMPTY_DRAFT);
    router.refresh();
  };

  const togglePublic = async (m: M) => {
    const key = `toggle:${m.id}`;
    if (!beginAction(key)) return;
    const nextPublic = !m.is_public;
    const result = await callMaterialsApi(`/api/admin/materials/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_public: nextPublic }),
    });
    endAction(key);
    if (!result.ok) {
      setErrorMessage(resolveErrorMessage(TOGGLE_ERROR_MESSAGES, result.code));
      return;
    }
    setStatusMessage(nextPublic ? "教材を公開しました" : "教材を非公開にしました");
    router.refresh();
  };

  const setStatus = async (m: M, nextStatus: string, selectEl: HTMLSelectElement) => {
    const key = `status:${m.id}`;
    const previousValue = m.license_status;
    // 同じ教材への2回目以降のchangeが(1回目がまだpending中のため)拒否される場合、
    // DOM上は既に新しい値へ変わっているselectを、未送信のまま成功したように
    // 見せないよう元の値へ戻す。
    if (!beginAction(key)) {
      selectEl.value = previousValue;
      return;
    }
    const result = await callMaterialsApi(`/api/admin/materials/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license_status: nextStatus }),
    });
    endAction(key);
    if (!result.ok) {
      selectEl.value = previousValue;
      setErrorMessage(resolveErrorMessage(STATUS_ERROR_MESSAGES, result.code));
      return;
    }
    setStatusMessage("許諾ステータスを更新しました");
    router.refresh();
  };

  const updateNote = async (m: M, note: string) => {
    if (note === (m.license_note ?? "")) return; // 変更なしなら送信しない
    const key = `note:${m.id}`;
    // pending中の再blur(同じ値でも異なる値でも)はrequestを増やさない。
    if (!beginAction(key)) return;
    const result = await callMaterialsApi(`/api/admin/materials/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ license_note: note }),
    });
    endAction(key);
    if (!result.ok) {
      // 入力欄はdefaultValueのまま(直接クリアしていない)なので、入力した文字は保持される。
      setErrorMessage(resolveErrorMessage(NOTE_ERROR_MESSAGES, result.code));
      return;
    }
    setStatusMessage("許諾メモを保存しました");
    router.refresh();
  };

  const remove = async (m: M) => {
    const key = `delete:${m.id}`;
    // confirm()はブラウザの同期的なブロッキングダイアログのため、表示中に同じ
    // 操作が重複起動されないよう、confirm()より前でrefガードを設定する。
    // キャンセル時はstatus/alertを一切変更せずrefのみfinallyで解除する。
    if (pendingActionsRef.current.has(key)) return;
    pendingActionsRef.current.add(key);
    try {
      if (!confirm(`「${m.title}」を削除しますか？ (関連単語も削除されます)`)) return;

      setPendingActions(new Set(pendingActionsRef.current));
      setStatusMessage(null);
      setErrorMessage(null);

      const result = await callMaterialsApi(`/api/admin/materials/${m.id}`, { method: "DELETE" });
      if (!result.ok) {
        setErrorMessage(resolveErrorMessage(DELETE_ERROR_MESSAGES, result.code));
        return;
      }
      setStatusMessage("教材を削除しました");
      router.refresh();
    } finally {
      pendingActionsRef.current.delete(key);
      setPendingActions(new Set(pendingActionsRef.current));
    }
  };

  return (
    <div aria-busy={pendingActions.size > 0}>
      <div className="flex justify-end mb-3">
        <Button size="sm" data-testid="material-create-toggle" onClick={() => setCreating((v) => !v)}>
          {creating ? "閉じる" : "＋ 新規追加"}
        </Button>
      </div>

      <p role="status" aria-live="polite" data-testid="material-mutation-status" className="mb-2 text-xs text-emerald-700 min-h-[1em]">
        {statusMessage ?? ""}
      </p>
      {errorMessage && (
        <p role="alert" data-testid="material-mutation-alert" className="mb-2 text-xs text-red-600">
          {errorMessage}
        </p>
      )}

      {creating && (
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 mb-5 bg-sky-50 rounded-xl p-4">
          <Field label="タイトル"><Input required data-testid="material-title-input" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
          <Field label="出版社"><Input value={draft.publisher} onChange={(e) => setDraft({ ...draft, publisher: e.target.value })} /></Field>
          <Field label="著者"><Input value={draft.author} onChange={(e) => setDraft({ ...draft, author: e.target.value })} /></Field>
          <Field label="レベル"><Input value={draft.level} onChange={(e) => setDraft({ ...draft, level: e.target.value })} placeholder="大学受験基礎 など" /></Field>
          <Field label="試験種別"><Input value={draft.exam_type} onChange={(e) => setDraft({ ...draft, exam_type: e.target.value })} placeholder="英検 / TOEIC など" /></Field>
          <Field label="出典URL"><Input value={draft.source_url} onChange={(e) => setDraft({ ...draft, source_url: e.target.value })} /></Field>
          <Field label="許諾ステータス">
            <Select value={draft.license_status} onChange={(e) => setDraft({ ...draft, license_status: e.target.value })}>
              <option value="pending">pending (未確認)</option>
              <option value="approved">approved (許諾済)</option>
              <option value="denied">denied (使用不可)</option>
            </Select>
          </Field>
          <Field label="公開">
            <Select value={draft.is_public ? "1" : "0"} onChange={(e) => setDraft({ ...draft, is_public: e.target.value === "1" })}>
              <option value="0">非公開</option>
              <option value="1">公開</option>
            </Select>
          </Field>
          <Field label="説明"><Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
          <Field label="許諾メモ"><Textarea value={draft.license_note} onChange={(e) => setDraft({ ...draft, license_note: e.target.value })} /></Field>
          <div className="sm:col-span-2">
            <Button type="submit" data-testid="material-create-submit" disabled={pendingActions.has("create")} fullWidth>
              {pendingActions.has("create") ? "登録中..." : "登録"}
            </Button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-navy-500 border-b border-navy-100">
            <tr>
              <th className="py-2 pr-3">タイトル</th>
              <th className="py-2 pr-3">レベル/試験</th>
              <th className="py-2 pr-3">許諾</th>
              <th className="py-2 pr-3">公開</th>
              <th className="py-2 pr-3">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-100">
            {materials.map((m) => (
              <tr key={m.id}>
                <td className="py-2 pr-3 align-top">
                  <div className="font-semibold text-navy-800">{m.title}</div>
                  {m.publisher && <div className="text-xs text-navy-500">{m.publisher}</div>}
                  {m.source_url && <a className="text-xs text-navy-600 underline" href={m.source_url} target="_blank" rel="noreferrer">出典</a>}
                  <input
                    className="mt-1 w-full text-xs border border-navy-200 rounded px-2 py-1 disabled:cursor-not-allowed disabled:opacity-60"
                    data-testid="material-license-note"
                    disabled={pendingActions.has(`note:${m.id}`)}
                    defaultValue={m.license_note ?? ""}
                    onBlur={(e) => updateNote(m, e.target.value)}
                    placeholder="許諾メモ"
                  />
                </td>
                <td className="py-2 pr-3 align-top text-xs">
                  <div>{m.level ?? "-"}</div>
                  <div className="text-navy-500">{m.exam_type ?? "-"}</div>
                </td>
                <td className="py-2 pr-3 align-top">
                  <select
                    defaultValue={m.license_status}
                    data-testid="material-license-status"
                    disabled={pendingActions.has(`status:${m.id}`)}
                    onChange={(e) => setStatus(m, e.target.value, e.target)}
                    className="text-xs border border-navy-200 rounded px-2 py-1"
                  >
                    <option value="pending">pending</option>
                    <option value="approved">approved</option>
                    <option value="denied">denied</option>
                  </select>
                </td>
                <td className="py-2 pr-3 align-top">
                  <button
                    data-testid="material-toggle-public"
                    disabled={pendingActions.has(`toggle:${m.id}`)}
                    onClick={() => togglePublic(m)}
                    className={`text-xs px-2 py-1 rounded disabled:opacity-60 ${m.is_public ? "bg-emerald-100 text-emerald-700" : "bg-navy-100 text-navy-700"}`}>
                    {m.is_public ? "公開中" : "非公開"}
                  </button>
                </td>
                <td className="py-2 pr-3 align-top">
                  <button
                    data-testid="material-delete"
                    disabled={pendingActions.has(`delete:${m.id}`)}
                    onClick={() => remove(m)}
                    className="text-xs text-red-600 underline disabled:opacity-60"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {materials.length === 0 && (
              <tr><td colSpan={5} className="py-6 text-center text-navy-500">教材がまだ登録されていません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
