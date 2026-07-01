// Loop Vocabulary 自動検証用テストアカウントの定義。
// 実ユーザーとは完全に別のメールアドレス・専用パスワード（.env.local にのみ保存）。
// これらのアカウントは is_test_account = true でマークされ、E2E/DBスクリプトはこのIDのみを操作する。

export const TEST_ACCOUNTS = {
  onboarding: {
    email: "test+onboarding@loop-vocabulary.app",
    passwordEnvKey: "TEST_ONBOARDING_PASSWORD",
    displayName: "TEST_onboarding",
    role: "student",
    purpose: "オンボーディング / dictionary直行 / 空状態 の検証用（毎回0件にリセットして使う）",
  },
  srs: {
    email: "test+srs@loop-vocabulary.app",
    passwordEnvKey: "TEST_SRS_PASSWORD",
    displayName: "TEST_srs",
    role: "student",
    purpose: "SRS V2 / 復習フロー / 先生機能の生徒側 の検証用",
  },
  teacher: {
    email: "test+teacher@loop-vocabulary.app",
    passwordEnvKey: "TEST_TEACHER_PASSWORD",
    displayName: "TEST_teacher",
    role: "teacher",
    purpose: "先生向け進捗管理（ロスター集計のみ表示）の検証用",
  },
};

export const TEST_CLASS_NAME = "TEST_検証クラス";
export const TEST_CLASS_INVITE_CODE = "TESTCLS1";
export const TEST_WORDBOOK_TITLE = "TEST_SRS単語帳";
