export const dynamic = "force-dynamic";

// Lets you confirm which build is actually deployed: GET /api/version
export function GET() {
  return Response.json({
    handler: "graphql-js", // the old graphql-yoga build has no /api/version route at all
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    commitMessage: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
    vercelEnv: process.env.VERCEL_ENV ?? null,
  });
}
