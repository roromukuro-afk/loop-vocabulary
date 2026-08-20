/**
 * scripts/testing/lib/devServer.mjs の shouldSkipBuildForCI() 単体テスト。
 *
 * Issue #109: PR Quality Gate(pr-ci-checks.mjs)が1ジョブ内で複数のcategory testを
 * 個別プロセスとして実行し、それぞれがensureServer()経由で毎回フルのnpm run buildを
 * 再実行していたため、20分timeoutを誘発していた。この単体テストは、CI環境かつ
 * .next/BUILD_IDが既に存在する場合だけビルドを省略し、それ以外(ローカル開発時・
 * .next未ビルド・明示的なexplicitSkipBuild)では既存の挙動を維持することを、
 * 実際のfs/npm/next呼び出しを一切行わずに確認する。
 *
 * 使い方: node scripts/testing/test-devserver-ci-build-reuse.mjs
 */
import { createServer } from "node:http";
import { shouldSkipBuildForCI, ensureServer } from "./lib/devServer.mjs";

let pass = 0, fail = 0;
function ok(msg) { console.log(`✅ ${msg}`); pass++; }
function bad(msg) { console.error(`❌ FAIL: ${msg}`); fail++; }

async function main() {
  // ---- CI環境 + .next/BUILD_IDが既に存在 -> ビルドを省略する ----
  {
    const result = shouldSkipBuildForCI({ explicitSkipBuild: undefined, isCI: true, nextBuildIdExists: true });
    if (result === true) ok("CI環境で.next/BUILD_IDが既に存在する場合、ビルドを省略する");
    else bad(`CI環境+既存ビルドでの判定が想定外: ${result}`);
  }

  // ---- CI環境だが.next/BUILD_IDが無い(まだ一度もbuildしていない) -> ビルドする ----
  {
    const result = shouldSkipBuildForCI({ explicitSkipBuild: undefined, isCI: true, nextBuildIdExists: false });
    if (result === false) ok("CI環境でも.next/BUILD_IDが無ければビルドを省略しない(初回buildは必ず実行される)");
    else bad(`CI環境+ビルド未実施での判定が想定外: ${result}`);
  }

  // ---- ローカル開発(CI未設定) + .next/BUILD_IDが存在 -> 既存の挙動どおり常にビルドする ----
  {
    const result = shouldSkipBuildForCI({ explicitSkipBuild: undefined, isCI: false, nextBuildIdExists: true });
    if (result === false) ok("ローカル開発(CI未設定)では.nextが既にあってもビルドを省略しない(振る舞い変更なし)");
    else bad(`ローカル開発での判定が想定外: ${result}`);
  }

  // ---- ローカル開発 + .next/BUILD_IDも無い -> 当然ビルドする ----
  {
    const result = shouldSkipBuildForCI({ explicitSkipBuild: undefined, isCI: false, nextBuildIdExists: false });
    if (result === false) ok("ローカル開発+ビルド未実施ではビルドを省略しない");
    else bad(`判定が想定外: ${result}`);
  }

  // ---- explicitSkipBuild:true が渡された場合、CI判定に関わらず常に省略する(既存の
  // skipBuildオプションの挙動を完全に維持する) ----
  {
    const r1 = shouldSkipBuildForCI({ explicitSkipBuild: true, isCI: false, nextBuildIdExists: false });
    const r2 = shouldSkipBuildForCI({ explicitSkipBuild: true, isCI: true, nextBuildIdExists: true });
    if (r1 === true && r2 === true) {
      ok("explicitSkipBuild:trueが渡された場合、CI判定・.nextの有無に関わらず常にビルドを省略する(既存opts.skipBuildの挙動を維持)");
    } else {
      bad(`explicitSkipBuild:trueでの判定が想定外: r1=${r1}, r2=${r2}`);
    }
  }

  // ---- explicitSkipBuild:false(明示的にfalse) -> CI自動判定にフォールバックする ----
  {
    const result = shouldSkipBuildForCI({ explicitSkipBuild: false, isCI: true, nextBuildIdExists: true });
    if (result === true) ok("explicitSkipBuild:falseの場合はCI自動判定の結果がそのまま使われる");
    else bad(`explicitSkipBuild:falseでの判定が想定外: ${result}`);
  }

  // ---- explicitForceRebuild:true が渡された場合、CI環境+既存.next/BUILD_IDが
  // あっても常にビルドする(NEXT_PUBLIC_*をこのジョブ内で変えて再検証したいテスト用) ----
  {
    const result = shouldSkipBuildForCI({ explicitForceRebuild: true, isCI: true, nextBuildIdExists: true });
    if (result === false) ok("explicitForceRebuild:trueの場合、CI環境+既存ビルドがあっても常にビルドし直す(build時に静的に埋め込まれる値を変更した検証を壊さない)");
    else bad(`explicitForceRebuild:trueでの判定が想定外: ${result}`);
  }

  // ---- explicitForceRebuild:true と explicitSkipBuild:true が同時に渡された場合、
  // forceRebuildを優先する(呼び出し側がソース変更を明示している方を信頼する) ----
  {
    const result = shouldSkipBuildForCI({ explicitForceRebuild: true, explicitSkipBuild: true, isCI: true, nextBuildIdExists: true });
    if (result === false) ok("explicitForceRebuildとexplicitSkipBuildが同時に渡された場合、forceRebuildが優先される");
    else bad(`両方渡された場合の判定が想定外: ${result}`);
  }

  // ---- 引数省略時、実際のprocess.env.CIとfs.existsSyncを参照する(デフォルト値の
  // 配線確認。このテスト実行環境自体はCI未設定のはずなので false になる) ----
  {
    const result = shouldSkipBuildForCI();
    if (typeof result === "boolean") {
      ok(`引数省略時もクラッシュせず、実際のprocess.env.CIとfsを参照して判定する(このテスト実行環境での結果: ${result})`);
    } else {
      bad(`引数省略時の戻り値が想定外の型: ${typeof result}`);
    }
  }

  // ---- ensureServer(): 指定ポートが既に別プロセスで占有されている場合、
  // opts.forceRebuild:trueを渡すと(opts.envと同じ理由で)例外を投げ、古いビルドの
  // サーバーを黙って再利用しない(Codexレビュー指摘対応、PR #110、2巡目: 修正前は
  // 占有ポートの早期returnがビルド判定より先に評価されるため、forceRebuild:trueが
  // 静かに無視されていた) ----
  {
    const port = 41932 + Math.floor(Math.random() * 1000);
    const occupier = createServer((_req, res) => res.end("ok")).listen(port);
    await new Promise((resolve) => occupier.once("listening", resolve));
    try {
      let threw = null;
      try {
        await ensureServer(port, { forceRebuild: true });
      } catch (e) {
        threw = e;
      }
      if (threw && /forceRebuild/.test(threw.message) && /occupied/.test(threw.message)) {
        ok("ensureServer(): ポートが既に占有されている場合、opts.forceRebuild:trueは例外を投げて古いビルドの黙った再利用を防ぐ");
      } else {
        bad(`ensureServer()のforceRebuild+占有ポートでの挙動が想定外: ${threw ? threw.message : "例外が投げられなかった"}`);
      }
    } finally {
      await new Promise((resolve) => occupier.close(resolve));
    }
  }

  if (fail > 0) {
    console.error("\n=== 失敗したチェックがあります ===");
    process.exitCode = 1;
  } else {
    console.log(`\n=== test:devserver-ci-build-reuse RESULT: ${pass} passed, ${fail} failed ===`);
  }
}

main().catch((e) => {
  console.error(`❌ 予期しない例外: ${e.message}`);
  process.exitCode = 1;
});
