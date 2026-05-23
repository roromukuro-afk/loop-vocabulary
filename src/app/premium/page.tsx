import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function PremiumPage() {
  return (
    <AppShell>
      <h1 className="text-2xl font-bold text-navy-800">広告非表示プラン</h1>
      <p className="text-sm text-navy-500 mt-1">学習に集中したいあなたへ。広告非表示 & AI/PDF制限解放。</p>

      <div className="mt-6 grid sm:grid-cols-2 gap-4">
        <Card>
          <CardTitle>無料</CardTitle>
          <ul className="text-sm text-navy-700 space-y-1.5 list-disc pl-5">
            <li>基本機能はすべて利用可</li>
            <li>単語登録数は多めに許可</li>
            <li>広告表示あり</li>
            <li>AI生成 1 日 5 回まで</li>
            <li>PDF 出力に回数制限</li>
          </ul>
        </Card>
        <Card className="border-navy-400 ring-2 ring-navy-200">
          <div className="text-xs font-semibold text-navy-500">おすすめ</div>
          <CardTitle>Loop Premium</CardTitle>
          <ul className="text-sm text-navy-700 space-y-1.5 list-disc pl-5">
            <li>広告非表示</li>
            <li>AI 生成回数を大幅増加</li>
            <li>PDF 出力 無制限</li>
            <li>教材別の詳細分析</li>
            <li>バックアップ強化</li>
          </ul>
          <Button className="mt-4" fullWidth disabled>近日公開</Button>
          <p className="text-[11px] text-navy-400 mt-2">※ 決済機能は現在開発中です。</p>
        </Card>
      </div>

      <p className="text-[11px] text-navy-400 mt-5">
        将来的にスマホアプリ版 (React Native / Capacitor) では AdMob を有効化し、
        広告非表示プラン購入で全広告枠を無効化する設計です。
      </p>
      <div className="mt-6">
        <Link href="/dashboard" className="text-sm text-navy-700 underline">← ダッシュボードへ戻る</Link>
      </div>
    </AppShell>
  );
}
