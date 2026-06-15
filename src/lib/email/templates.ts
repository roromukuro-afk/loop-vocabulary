export function premiumWelcomeHtml(displayName: string, plan: "monthly" | "yearly"): string {
  const planLabel = plan === "yearly" ? "年間プラン（¥3,800/年）" : "月額プラン（¥480/月）";
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f9fc;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
  <div style="background:linear-gradient(135deg,#b45309,#d97706);padding:32px 32px 24px;text-align:center;">
    <div style="font-size:40px;margin-bottom:8px;">⭐</div>
    <div style="font-size:22px;font-weight:900;color:#fff;">Premium 登録完了！</div>
    <p style="color:#fef3c7;margin:6px 0 0;font-size:13px;">Loop Vocabulary</p>
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:18px;color:#1e3a5f;margin:0 0 12px;">🎉 ${displayName || "学習者"}さん、ありがとうございます！</h1>
    <p style="color:#475569;font-size:14px;line-height:1.7;margin:0 0 20px;">
      <strong>${planLabel}</strong> にご登録いただきました。<br>
      すべてのプレミアム機能が今すぐご利用いただけます。
    </p>
    <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:12px;padding:20px;margin:20px 0;">
      <p style="font-size:13px;font-weight:700;color:#92400e;margin:0 0 12px;">✨ Premium で使えるようになった機能</p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${[
          "🤖 AI解説（例文・語源・ニュアンス）が毎日無制限",
          "🔬 AI弱点分析レポートで効率学習",
          "✨ 英文から語彙を自動抽出（AI）",
          "📁 CSV単語一括インポート",
          "🚫 広告が完全に非表示",
          "📊 学習統計の書き出し・PDF出力無制限",
        ].map(f => `<div style="font-size:13px;color:#92400e;">${f}</div>`).join("")}
      </div>
    </div>
    <div style="text-align:center;margin:24px 0 0;">
      <a href="https://loop-vocabulary.vercel.app/dashboard" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:14px;">
        今すぐ学習を始める →
      </a>
    </div>
  </div>
  <div style="border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">
      サブスクリプション管理は <a href="https://loop-vocabulary.vercel.app/settings" style="color:#64748b;">設定ページ</a> から。<br>
      いつでもキャンセル可能です。
    </p>
  </div>
</div>
</body>
</html>`;
}

export function welcomeEmailHtml(displayName: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f9fc;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
  <div style="background:linear-gradient(135deg,#1e3a5f,#0f2540);padding:32px 32px 24px;text-align:center;">
    <div style="font-size:28px;font-weight:900;color:#fff;letter-spacing:-0.5px;">Loop <span style="color:#38bdf8;">Vocabulary</span></div>
    <p style="color:#94a3b8;margin:8px 0 0;font-size:14px;">英単語学習アプリ</p>
  </div>
  <div style="padding:32px;">
    <h1 style="font-size:20px;color:#1e3a5f;margin:0 0 16px;">ようこそ、${displayName || "学習者"}さん！ 🎉</h1>
    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Loop Vocabulary へのご登録ありがとうございます。<br>
      忘却曲線・AI解説・4択テストを組み合わせた学習で、英単語を長期記憶に定着させましょう。
    </p>
    <div style="background:#f0f9ff;border-radius:12px;padding:20px;margin:20px 0;">
      <p style="font-size:13px;font-weight:700;color:#0369a1;margin:0 0 12px;">まずはこの3ステップから</p>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${["1️⃣ 単語帳を作る — テーマを決めてスタート", "2️⃣ 最初の10語を登録 — 辞書検索からワンタップ", "3️⃣ 今日の復習 — SRSが自動でスケジュール"].map(s => `<div style="font-size:13px;color:#1e3a5f;">${s}</div>`).join("")}
      </div>
    </div>
    <div style="text-align:center;margin:28px 0 0;">
      <a href="https://loop-vocabulary.vercel.app/dashboard" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:15px;">
        ダッシュボードへ →
      </a>
    </div>
  </div>
  <div style="border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
    <p style="color:#94a3b8;font-size:12px;margin:0;">
      このメールはLoop Vocabularyに登録したアカウントに送信されています。<br>
      <a href="https://loop-vocabulary.vercel.app/settings" style="color:#64748b;">通知設定</a> |
      <a href="https://loop-vocabulary.vercel.app/privacy" style="color:#64748b;">プライバシーポリシー</a>
    </p>
  </div>
</div>
</body>
</html>`;
}

export function weeklyDigestHtml(opts: {
  displayName: string;
  weeklyStudied: number;
  weeklyCorrect: number;
  dueCount: number;
  streak: number;
  isPremium?: boolean;
}): string {
  const { displayName, weeklyStudied, weeklyCorrect, dueCount, streak, isPremium = false } = opts;
  const acc = weeklyStudied > 0 ? Math.round((weeklyCorrect / weeklyStudied) * 100) : 0;
  const emoji = acc >= 80 ? "🎯" : acc >= 60 ? "📚" : "💪";

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f9fc;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
  <div style="background:linear-gradient(135deg,#1e3a5f,#0f2540);padding:28px 32px;text-align:center;">
    <div style="font-size:22px;font-weight:900;color:#fff;">Loop <span style="color:#38bdf8;">Vocabulary</span></div>
    <p style="color:#94a3b8;margin:6px 0 0;font-size:13px;">週次学習レポート</p>
  </div>
  <div style="padding:28px 32px;">
    <h1 style="font-size:18px;color:#1e3a5f;margin:0 0 4px;">${emoji} 今週もお疲れさまでした！</h1>
    <p style="color:#64748b;font-size:14px;margin:0 0 24px;">${displayName || "学習者"}さんの今週の学習まとめ</p>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:24px;">
      ${[
        ["今週の学習数", `${weeklyStudied}語`, "#dbeafe", "#1d4ed8"],
        ["正答率", `${acc}%`, "#dcfce7", "#15803d"],
        ["連続学習", `${streak}日`, "#fef3c7", "#d97706"],
      ].map(([label, val, bg, color]) =>
        `<div style="background:${bg};border-radius:12px;padding:14px;text-align:center;">
          <div style="font-size:22px;font-weight:900;color:${color};">${val}</div>
          <div style="font-size:11px;color:#475569;margin-top:4px;">${label}</div>
        </div>`
      ).join("")}
    </div>
    ${dueCount > 0 ? `
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="font-size:14px;color:#9a3412;font-weight:700;margin:0 0 4px;">📌 復習待ち: ${dueCount}語</p>
      <p style="font-size:13px;color:#c2410c;margin:0;">忘れる前に復習しておきましょう！</p>
    </div>` : `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin-bottom:24px;">
      <p style="font-size:14px;color:#15803d;font-weight:700;margin:0;">✅ 復習はすべて完了しています！</p>
    </div>`}
    <div style="text-align:center;margin-bottom:${isPremium ? "0" : "20px"};">
      <a href="https://loop-vocabulary.vercel.app/dashboard" style="display:inline-block;background:#1e3a5f;color:#fff;text-decoration:none;padding:13px 32px;border-radius:10px;font-weight:700;font-size:14px;">
        今週も学習を続ける →
      </a>
    </div>
    ${!isPremium ? `
    <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:1px solid #fbbf24;border-radius:12px;padding:20px;text-align:center;">
      <div style="font-size:15px;font-weight:900;color:#92400e;margin-bottom:8px;">⚡ Premiumにアップグレードしませんか？</div>
      <p style="font-size:13px;color:#78350f;margin:0 0 14px;line-height:1.6;">
        広告なし・AI解説無制限・弱点分析・CSV一括インポートが<br>
        <strong>月額たった¥480</strong> で使えます。
      </p>
      <a href="https://loop-vocabulary.vercel.app/premium" style="display:inline-block;background:#92400e;color:#fff;text-decoration:none;padding:11px 28px;border-radius:10px;font-weight:700;font-size:13px;">
        詳しく見る →
      </a>
    </div>` : ""}
  </div>
  <div style="border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">
      <a href="https://loop-vocabulary.vercel.app/settings" style="color:#64748b;">通知設定を変更</a> |
      <a href="https://loop-vocabulary.vercel.app/privacy" style="color:#64748b;">プライバシーポリシー</a>
    </p>
  </div>
</div>
</body>
</html>`;
}
