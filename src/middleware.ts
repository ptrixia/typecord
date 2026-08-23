import { withAuth } from "next-auth/middleware";

export default withAuth(
  function middleware(req) {
    return;
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