/**
 * /exam-countdown-planner の教材選択ロジック(src/lib/utils/examCountdownMaterials.ts)の
 * ユニットテスト。DBアクセス・Reactを一切使わない純粋関数のみを対象にする。
 *
 * 使い方: node scripts/testing/test-exam-countdown-material-selection.mjs
 */
import {
  groupMaterialsByExamType,
  resolveWordCountFromMaterial,
} from "../../src/lib/utils/examCountdownMaterials.ts";

let pass = 0, fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

const SAMPLE = [
  { id: "e1", title: "英検2級 重要単語", examType: "英検", level: "英検2級", wordCount: 1200 },
  { id: "e2", title: "英検準1級 重要単語", examType: "英検", level: "英検準1級", wordCount: 2000 },
  { id: "t1", title: "TOEIC 頻出単語 2500", examType: "TOEIC", level: null, wordCount: 2500 },
  { id: "n1", title: "分類不明教材", examType: null, wordCount: 300 },
];

function main() {
  // ---- groupMaterialsByExamType ----
  {
    const groups = groupMaterialsByExamType(SAMPLE);
    const keys = groups.map(([k]) => k);
    if (JSON.stringify(keys) === JSON.stringify(["英検", "TOEIC", "その他"])) {
      ok(`exam_typeの初出順にグループ化される: ${JSON.stringify(keys)}`);
    } else {
      bad(`グループの順序が想定外: ${JSON.stringify(keys)}`);
    }

    const eikenGroup = groups.find(([k]) => k === "英検")?.[1] ?? [];
    if (eikenGroup.length === 2 && eikenGroup[0].id === "e1" && eikenGroup[1].id === "e2") {
      ok("同じexam_typeの教材が同一グループにまとまり、元の並び順を維持する");
    } else {
      bad(`英検グループの中身が想定外: ${JSON.stringify(eikenGroup)}`);
    }

    const otherGroup = groups.find(([k]) => k === "その他")?.[1] ?? [];
    if (otherGroup.length === 1 && otherGroup[0].id === "n1") {
      ok("exam_typeがnullの教材は「その他」グループにまとまる");
    } else {
      bad(`「その他」グループの中身が想定外: ${JSON.stringify(otherGroup)}`);
    }
  }

  // ---- groupMaterialsByExamType: 空配列 ----
  {
    const groups = groupMaterialsByExamType([]);
    if (groups.length === 0) ok("空配列を渡すと空のグループ一覧が返る");
    else bad(`空配列に対する結果が想定外: ${JSON.stringify(groups)}`);
  }

  // ---- resolveWordCountFromMaterial ----
  {
    const wc = resolveWordCountFromMaterial(SAMPLE, "t1");
    if (wc === 2500) ok(`存在する教材IDに対して正しい語数が返る: ${wc}`);
    else bad(`語数の解決結果が想定外: ${wc}`);
  }
  {
    const wc = resolveWordCountFromMaterial(SAMPLE, "does-not-exist");
    if (wc === null) ok("存在しない教材IDに対してnullが返る");
    else bad(`存在しない教材IDに対する結果が想定外: ${wc}`);
  }
  {
    const wc = resolveWordCountFromMaterial(SAMPLE, "");
    if (wc === null) ok("空文字のIDに対してnullが返る");
    else bad(`空文字IDに対する結果が想定外: ${wc}`);
  }

  console.log(`\n=== test:exam-countdown-material-selection RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main();
