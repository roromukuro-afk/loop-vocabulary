/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  async redirects() {
    // VercelデフォルトドメインをGoogleがcanonicalとして誤選択し重複コンテンツ扱いに
    // なる問題への対応。ここに列挙した各ホスト宛のリクエストのみ、パス・クエリを
    // 維持したままカスタムドメインへ恒久リダイレクトする（Host完全一致時のみ発火するため
    // localhost・preview/branchデプロイ(ハッシュ付きURL)の別ホスト名には影響しない）。
    //
    // 2026-07-15時点でVercelプロジェクトのProduction Domainsに実際に紐づくvercel.app系
    // エイリアス(mcp__vercel__get_project domains参照)を全て列挙している。
    // - loop-vocabulary-roromukuro-5711s-projects.vercel.app と
    //   loop-vocabulary-git-main-roromukuro-5711s-projects.vercel.app は
    //   現状Vercel Authentication(デプロイ保護)により未認証アクセスが
    //   vercel.com/sso-apiへ302されるため、この時点ではGoogleに直接クロールされない
    //   (=重複コンテンツリスクは無い)。ただし保護設定が将来外れた場合に備えた
    //   多層防御として、ここでもリダイレクト対象に含めておく。
    // - Search Consoleで報告された `loop-vocabulary.app.vercel.app` は、Vercelの
    //   エッジIPには到達するがそのホスト名向けのTLS証明書が存在せず
    //   (SSL/TLSハンドシェイク自体が失敗する)、現時点でこのプロジェクトはおろか
    //   Vercel上のどのプロジェクトにも実際には紐づいていない。next.config.jsの
    //   redirects()はアプリコードに到達したリクエストにしか効かないため、TLSの
    //   時点で失敗するこのホストにはアプリ側で対処のしようがない
    //   (Search Console側の古いクロール記録の可能性が高い)。
    const legacyVercelHosts = [
      "loop-vocabulary.vercel.app",
      "loop-vocabulary-roromukuro-5711s-projects.vercel.app",
      "loop-vocabulary-git-main-roromukuro-5711s-projects.vercel.app",
    ];
    return legacyVercelHosts.map((host) => ({
      source: "/:path*",
      has: [{ type: "host", value: host }],
      destination: "https://loop-vocabulary.app/:path*",
      permanent: true,
    }));
  },
};
module.exports = nextConfig;
