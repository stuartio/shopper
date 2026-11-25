export const dynamic = "force-dynamic";

// Lets you confirm which build is actually deployed: GET /api/version
export function GET() {
  return Response.json({
    handler: "graphql-js", // the old graphql-yoga build has no /api/version route at all
    version: process.env.NEXT_PUBLIC_APP_VERSION,
    commit: process.env.NEXT_PUBLIC_COMMIT,
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
