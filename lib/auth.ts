import { SignJWT, jwtVerify } from "jose";

export const COOKIE_NAME = "shopper_session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET ?? "dev-only-insecure-secret-change-me");

export const signToken = (userId: string) =>
  new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setExpirationTime("7d").sign(secret);

export async function verifyToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// Public GraphQL API: "Authorization: Bearer <api key>".
export function extractBearer(request: Request): string | null {
  const auth = request.headers.get("authorization");
  return auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() || null : null;
}

// Web UI session cookie.
export function extractSessionCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE_NAME) return decodeURIComponent(v.join("="));
  }
  return null;
}

export const sessionCookie = (token: string) =>
  `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 3600}${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;

export const clearCookie = `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
