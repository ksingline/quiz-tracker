import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY",
  );
}

const LOGIN_PATH = "/login";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return req.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        res.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: any) {
        res.cookies.set({ name, value: "", ...options });
      },
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const path = req.nextUrl.pathname;
  const isLogin = path === LOGIN_PATH;

  if (!session && !isLogin) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = LOGIN_PATH;
    redirectUrl.searchParams.set("redirectTo", path);
    return NextResponse.redirect(redirectUrl);
  }

  if (session && isLogin) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/.*).*)"],
};
