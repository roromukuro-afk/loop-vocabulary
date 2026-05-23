"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { createClient } from "@/lib/supabase/client";

type M = {
  id: string; title: string; publisher: string | null;
  level: string | null; exam_type: string | null;
  is_public: boolean; license_status: string;
  license_note: string | null; source_url: string | null;
};

export function MaterialAdminTable({ materials }: { materials: M[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    title: "", publisher: "", author: "", description: "",
    level: "", exam_type: "", source_url: "",
    license_status: "pending", license_note: "", is_public: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null);
    const supabase = createClient();
    const { error } = await supabase.from("materials").insert(draft);
    setBusy(false);
    if (error) return setError(error.message);
    setCreating(false);
    setDraft({ title: "", publisher: "", author: "", description: "", level: "", exam_type: "", source_url: "", license_status: "pending", license_note: "", is_public: false });
    router.refresh();
  };

  const togglePublic = async (m: M) => {
    const supabase = createClient();
    await supabase.from("materials").update({ is_public: !m.is_public }).eq("id", m.id);
    router.refresh();
  };
  const setStatus = async (m: M, status: string) => {
    const supabase = createClient();
    await supabase.from("materials").update({ license_status: status }).eq("id", m.id);
    router.refresh();
  };
  const updateNote = async (m: M, note: string) => {
    const supabase = createClient();
    await supabase.from("materials").update({ license_note: note }).eq("id", m.id);
    router.refresh();
  };
  const remove = async (m: M) => {
    if (!confirm(`「${m.title}」を削除しますか？ (関連単語も削除されます)`)) return;
    const supabase = createClient();
    await supabase.from("materials").delete().eq("id", m.id);
    router.refresh();
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setCreating((v) => !v)}>
          {creating ? "閉じる" : "＋ 新規追加"}
        </Button>
      </div>

      {creating && (
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 mb-5 bg-sky-50 rounded-xl p-4">
          <Field label="タイトル"><Input required value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></Field>
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
          {error && <div className="text-sm text-red-600 sm:col-span-2">{error}</div>}
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy} fullWidth>{busy ? "登録中..." : "登録"}</Button>
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
                    className="mt-1 w-full text-xs border border-navy-200 rounded px-2 py-1"
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
                    onChange={(e) => setStatus(m, e.target.value)}
                    className="text-xs border border-navy-200 rounded px-2 py-1"
                  >
                    <option value="pending">pending</option>
                    <option value="approved">approved</option>
                    <option value="denied">denied</option>
                  </select>
                </td>
                <td className="py-2 pr-3 align-top">
                  <button onClick={() => togglePublic(m)}
                    className={`text-xs px-2 py-1 rounded ${m.is_public ? "bg-emerald-100 text-emerald-700" : "bg-navy-100 text-navy-700"}`}>
                    {m.is_public ? "公開中" : "非公開"}
                  </button>
                </td>
                <td className="py-2 pr-3 align-top">
                  <button onClick={() => remove(m)} className="text-xs text-red-600 underline">削除</button>
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
