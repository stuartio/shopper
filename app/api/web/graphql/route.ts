import { webYoga } from "@/lib/graphql";

export const dynamic = "force-dynamic";

// Private endpoint used by this site's own UI (session cookie auth). The documented public API is /api/graphql.
const handler = (request: Request) => webYoga.fetch(request);

export { handler as GET, handler as POST };
