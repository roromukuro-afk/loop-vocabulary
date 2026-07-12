/**
 * 教材名（materials.title）に含まれる語数表記と、実際の収録語数（material_words件数）の
 * 整合性を監査する。AdSense審査前監査 Phase 1。
 *
 * ・読み取り専用。DBへの書き込みは一切行わない。
 * ・出力: reports/material-count-consistency.json（機械可読）/ reports/material-count-consistency.md（要約）
 *
 * 判定ルール:
 *  - タイトルから数字（800, 600, 2500 等。「2000+」のような"+"付きは下限表記として別扱い）を抽出
 *  - 数字なしタイトルは対象外（問題なし）
 *  - 「N+」表記は実数 >= N なら OK、実数 < N なら不整合
 *  - 通常表記は 実数 が [N*0.85, N*1.15] の範囲外なら不整合として報告
 *
 * 使い方: node scripts/audit/material-count-consistency.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { getAdminClient } from "../testing/lib/supabaseAdmin.mjs";
import { loadEnv, REPO_ROOT } from "../testing/lib/env.mjs";

const TOLERANCE = 0.15; // ±15%以内は許容

function extractCountClaim(title) {
  // 「2000+」のような下限表記
  const plusMatch = title.match(/(\d{2,5})\+/);
  if (plusMatch) return { value: Number(plusMatch[1]), isLowerBound: true };
  // 「2026年度」のような年度表記は語数claimではないため除外
  const withoutYear = title.replace(/\d{4}年度?/g, "");
  // 通常の数字表記（末尾または語尾に付く数字を優先。「1900」「800」等）
  const matches = [...withoutYear.matchAll(/(\d{2,5})/g)];
  if (matches.length === 0) return null;
  // 最後にマッチした数字を採用（「TOEIC 頻出単語 2500」のように末尾が語数であることが多い）
  const last = matches[matches.length - 1];
  return { value: Number(last[1]), isLowerBound: false };
}

export async function auditMaterialCountConsistency(admin) {
  const { data: materials, error } = await admin
    .from("materials")
    .select("id, title, is_public, license_status, publisher, author, license_note")
    .order("title", { ascending: true });
  if (error) throw new Error(`materials fetch failed: ${error.message}`);

  const results = [];
  for (const m of materials ?? []) {
    const { count, error: countErr } = await admin
      .from("material_words")
      .select("*", { count: "exact", head: true })
      .eq("material_id", m.id);
    if (countErr) throw new Error(`material_words count failed for ${m.id}: ${countErr.message}`);
    const actual = count ?? 0;
    const claim = extractCountClaim(m.title);

    let status = "no_claim";
    let note = "";
    if (claim) {
      if (claim.isLowerBound) {
        status = actual >= claim.value ? "ok" : "mismatch";
        note = `タイトルは下限表記「${claim.value}+」。実数${actual}語。`;
      } else {
        const lower = claim.value * (1 - TOLERANCE);
        const upper = claim.value * (1 + TOLERANCE);
        status = actual >= lower && actual <= upper ? "ok" : "mismatch";
        note = `タイトル表記${claim.value}語 / 実数${actual}語（許容範囲 ${Math.round(lower)}〜${Math.round(upper)}語）。`;
      }
    }

    results.push({
      id: m.id,
      title: m.title,
      is_public: m.is_public,
      license_status: m.license_status,
      publisher: m.publisher,
      author: m.author,
      license_note: m.license_note,
      claimedCount: claim?.value ?? null,
      isLowerBoundClaim: claim?.isLowerBound ?? false,
      actualCount: actual,
      status,
      note,
      // license_status="approved"だが出典(publisher/author/license_note)が未記録の教材は
      // Phase 3の権利監査対象としてもフラグを立てる
      needsSourceDocumentation:
        m.license_status === "approved" && !m.publisher && !m.author && !m.license_note,
    });
  }

  const mismatches = results.filter((r) => r.status === "mismatch");
  const needsSourceDoc = results.filter((r) => r.needsSourceDocumentation);

  return { results, mismatches, needsSourceDoc };
}

function toMarkdown({ results, mismatches, needsSourceDoc }) {
  const lines = [];
  lines.push("# 教材名/語数整合性 監査レポート");
  lines.push("");
  lines.push(`生成日時: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`- 監査対象教材数: ${results.length}`);
  lines.push(`- 語数表記あり: ${results.filter((r) => r.claimedCount !== null).length}`);
  lines.push(`- 不整合(mismatch): ${mismatches.length}`);
  lines.push(`- 出典未記録(approved but no publisher/author/license_note): ${needsSourceDoc.length}`);
  lines.push("");

  if (mismatches.length > 0) {
    lines.push("## 不整合一覧");
    lines.push("");
    lines.push("| id | title | claimed | actual | note |");
    lines.push("|---|---|---|---|---|");
    for (const r of mismatches) {
      lines.push(`| ${r.id} | ${r.title} | ${r.claimedCount}${r.isLowerBoundClaim ? "+" : ""} | ${r.actualCount} | ${r.note} |`);
    }
    lines.push("");
  } else {
    lines.push("## 不整合一覧");
    lines.push("");
    lines.push("不整合なし（2026-07-12ラウンドで検出された4件は修正済み: 英検2級 基礎単語 / 英検準1級 基礎単語 / TOEIC頻出基礎単語 / TOEIC 頻出単語 2500）。");
    lines.push("");
  }

  if (needsSourceDoc.length > 0) {
    lines.push("## 出典未記録の要確認教材（license_status=approvedだがpublisher/author/license_noteが空）");
    lines.push("");
    lines.push("これらは自社データか外部データか判別できないため、人間による出典確認が必要です。");
    lines.push("");
    lines.push("| id | title | actual words |");
    lines.push("|---|---|---|");
    for (const r of needsSourceDoc) {
      lines.push(`| ${r.id} | ${r.title} | ${r.actualCount} |`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  loadEnv();
  const admin = getAdminClient();
  const report = await auditMaterialCountConsistency(admin);

  const reportsDir = resolve(REPO_ROOT, "reports");
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(resolve(reportsDir, "material-count-consistency.json"), JSON.stringify(report, null, 2));
  writeFileSync(resolve(reportsDir, "material-count-consistency.md"), toMarkdown(report));

  console.log(`監査対象: ${report.results.length}件 / 不整合: ${report.mismatches.length}件 / 出典未記録: ${report.needsSourceDoc.length}件`);
  console.log("reports/material-count-consistency.json / .md を出力しました。");

  if (report.mismatches.length > 0) {
    console.log("\n=== 不整合あり ===");
    for (const m of report.mismatches) {
      console.log(`  - ${m.title} (${m.id}): claimed=${m.claimedCount}${m.isLowerBoundClaim ? "+" : ""} actual=${m.actualCount}`);
    }
  }
}

if (process.argv[1]?.endsWith("material-count-consistency.mjs")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
