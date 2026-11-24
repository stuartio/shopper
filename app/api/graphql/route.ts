import { yoga } from "@/lib/graphql";

export const dynamic = "force-dynamic";

const handler = (request: Request) => yoga.fetch(request);

export { handler as GET, handler as POST, handler as OPTIONS };
