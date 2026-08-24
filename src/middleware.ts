import { withAuth } from "next-auth/middleware";
import { NextResponse, userAgent } from "next/server"; // <-- Importe o userAgent aqui

export default withAuth(
  function middleware(req) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const { os, device, browser } = userAgent(req);
    
    const osName = os.name || "Unknown OS";
    const osVersion = os.version || "";
    const deviceType = device.type || "desktop"; 

    const method = req.method;
    const pathname = req.nextUrl.pathname;

    console.log(
      `[REQUEST] ${method} ${pathname} | IP: ${ip} | OS: ${osName} (${osVersion}) | Device: ${deviceType} | Browser: ${browser.name}`
    );

    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
  }
);

export const config = {
  matcher: [
    "/channels/:path*",
    "/api/((?!auth(?:/.*)?$|register$|gateway(?:/.*)?$|channels/[^/]+/messages$).*)",
  ],
};