import { handleWeb } from "@/lib/graphql";

export const dynamic = "force-dynamic";

// Private endpoint used by this site's own UI (session cookie auth). The documented public API is /api/graphql.
export { handleWeb as GET, handleWeb as POST };
