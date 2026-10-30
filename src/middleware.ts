// Server-side gate for every page and API: valid signed session + correct role.
import { NextResponse, type NextRequest } from "next/server";
import { HOME, SESSION_COOKIE, allowedRoles, decodeSession, portalFor } from "@/lib/session-token";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const session = decodeSession(req.cookies.get(SESSION_COOKIE)?.value);

  if (pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/auth/") || pathname === "/api/status") return NextResponse.next();
    if (!session) return NextResponse.json({ error: "Please sign in.", code: "UNAUTHORIZED" }, { status: 401 });
    return NextResponse.next(); // role + ownership are enforced inside each API route
  }

  const roles = allowedRoles(pathname);
  if (!roles) {
    // Public: landing + login/register. Signed-in users skip straight to their dashboard.
    if (session && pathname !== "/welcome") return NextResponse.redirect(new URL(HOME[session.role], req.url));
    return NextResponse.next();
  }
  if (!session) {
    if (pathname === "/") return NextResponse.redirect(new URL("/welcome", req.url));
    const url = new URL(`/${portalFor(pathname)}/login`, req.url);
    url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  if (!roles.includes(session.role)) return NextResponse.redirect(new URL(`${HOME[session.role]}?denied=1`, req.url));
  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: ["/((?!_next/|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|css|js|map)$).*)"],
};
