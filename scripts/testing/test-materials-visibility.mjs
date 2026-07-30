/**
 * isEffectivelyPublicMaterial()の単体テスト(ネットワーク・DBアクセス不要)。
 *
 * /materials/[id]の実際の公開可否は`is_public`単独ではなく、RLSポリシー
 * "materials public read"・ページ側の実クエリの両方が要求する
 * `is_public=true かつ license_status IN ('approved','original')`で決まる。
 * IndexNowの即時通知要否をこの実際の公開可否の遷移で判定するため
 * (/api/admin/materials・/api/admin/materials/[id]参照)、この関数自体の
 * 正しさを網羅的に検証する。
 *
 * 使い方: node scripts/testing/test-materials-visibility.mjs
 */
import { isEffectivelyPublicMaterial } from "../../src/lib/materials/visibility.ts";

let failed = 0;
function ok(msg) { console.log(`✅ ${msg}`); }
function fail(msg) { console.error(`❌ FAIL: ${msg}`); failed++; }
function assertEqual(actual, expected, msg) {
  if (actual === expected) ok(msg);
  else fail(`${msg} (期待値=${expected}, 実際=${actual})`);
}

function main() {
  assertEqual(
    isEffectivelyPublicMaterial({ is_public: true, license_status: "approved" }),
    true,
    "is_public=true かつ license_status=approved は公開扱い",
  );
  assertEqual(
    isEffectivelyPublicMaterial({ is_public: true, license_status: "original" }),
    true,
    "is_public=true かつ license_status=original は公開扱い(Loop自社オリジナル教材)",
  );
  assertEqual(
    isEffectivelyPublicMaterial({ is_public: true, license_status: "pending" }),
    false,
    "is_public=true でも license_status=pending は非公開扱い(許諾未確認)",
  );
  assertEqual(
    isEffectivelyPublicMaterial({ is_public: true, license_status: "denied" }),
    false,
    "is_public=true でも license_status=denied は非公開扱い(使用不可)",
  );
  assertEqual(
    isEffectivelyPublicMaterial({ is_public: false, license_status: "approved" }),
    false,
    "license_status=approved でも is_public=false は非公開扱い",
  );
  assertEqual(
    isEffectivelyPublicMaterial({ is_public: false, license_status: "pending" }),
    false,
    "is_public=false かつ license_status=pending は非公開扱い",
  );

  console.log(failed ? `\n=== test:materials-visibility: ${failed}件失敗 ===` : "\n=== test:materials-visibility RESULT: all checks passed ===");
  process.exit(failed ? 1 : 0);
}

main();
