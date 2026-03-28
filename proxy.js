import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getLoginRedirectTarget } from "@/lib/auth-redirect";

const PROTECTED_PATH_PREFIXES = [
  "/dashboard",
  "/upload",
  "/pricing",
  "/analyze",
  "/compare",
  "/analysis",
  "/proposal",
];

function isProtectedPath(pathname) {
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export async function proxy(request) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;
  const isLoginRoute = pathname === "/login";

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isLoginRoute) {
    const nextTarget = getLoginRedirectTarget(
      request.nextUrl.searchParams.get("next"),
      request.nextUrl.origin
    );
    return NextResponse.redirect(new URL(nextTarget, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/upload/:path*",
    "/pricing/:path*",
    "/analyze/:path*",
    "/compare/:path*",
    "/analysis/:path*",
    "/proposal/:path*",
    "/login",
  ],
};
