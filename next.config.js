/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { serverActions: { bodySizeLimit: "2mb" } },
  async redirects() {
    return [
      // VercelデフォルトドメインをGoogleがcanonicalとして誤選択し重複コンテンツ扱いに
      // なる問題への対応。loop-vocabulary.vercel.app宛のリクエストのみ、パス・クエリを
      // 維持したままカスタムドメインへ恒久リダイレクトする（Host一致時のみ発火するため
      // localhost・preview/branchデプロイの別ホスト名には影響しない）。
      {
        source: "/:path*",
        has: [{ type: "host", value: "loop-vocabulary.vercel.app" }],
        destination: "https://loop-vocabulary.app/:path*",
        permanent: true,
      },
    ];
  },
};
module.exports = nextConfig;
