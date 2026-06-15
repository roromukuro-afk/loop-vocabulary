import { NextRequest, NextResponse } from "next/server";
import { getResend, FROM_EMAIL } from "@/lib/email/resend";
import { SUPPORT_EMAIL } from "@/lib/support";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, email, topic, message } = body as Record<string, string>;

  if (!email || !message || message.length < 10) {
    return NextResponse.json({ error: "内容を入力してください" }, { status: 400 });
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: "メール設定が未完了です" }, { status: 500 });
  }

  try {
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: SUPPORT_EMAIL,
      replyTo: email,
      subject: `【Loop Vocabulary お問い合わせ】${topic ?? "その他"} — ${name ?? email}`,
      html: `
        <h2>Loop Vocabulary お問い合わせ</h2>
        <table style="border-collapse:collapse;width:100%;font-size:14px;">
          <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:bold;width:120px;">お名前</td><td style="padding:6px 12px;">${name ?? "未入力"}</td></tr>
          <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:bold;">メール</td><td style="padding:6px 12px;">${email}</td></tr>
          <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:bold;">種別</td><td style="padding:6px 12px;">${topic ?? "未選択"}</td></tr>
          <tr><td style="padding:6px 12px;background:#f1f5f9;font-weight:bold;vertical-align:top;">内容</td><td style="padding:6px 12px;white-space:pre-wrap;">${message}</td></tr>
        </table>
      `,
    });

    // 送信者への自動返信
    await getResend().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: "【Loop Vocabulary】お問い合わせを受け付けました",
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f7f9fc;border-radius:12px;">
          <h2 style="color:#1e3a5f;">お問い合わせありがとうございます</h2>
          <p style="color:#475569;font-size:14px;line-height:1.7;">
            以下の内容でお問い合わせを受け付けました。<br>
            通常 <strong>2〜3営業日以内</strong> にご返信いたします。
          </p>
          <div style="background:#fff;border-radius:8px;padding:16px;margin-top:16px;font-size:13px;color:#334155;">
            <strong>種別:</strong> ${topic ?? "未選択"}<br>
            <strong>内容:</strong><br>
            <div style="white-space:pre-wrap;margin-top:8px;">${message}</div>
          </div>
          <p style="color:#94a3b8;font-size:11px;margin-top:24px;">Loop Vocabulary サポート</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
