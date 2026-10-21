import { NextResponse } from "next/server";

// StaffAuth validates /auth/me after hydration. No JS-readable cookie is trusted here.
// Backend guards and socket authorization enforce access; this pass-through is UX only.
export function middleware() {
  return NextResponse.next();
}
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
