import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, authEnabled, cookieOptions, safeEqual, sessionToken } from "@/lib/auth";

export async function middleware(req: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  const token = await sessionToken();
  const url = req.nextUrl;

  // Lien du CRM : https://…/?key=MOT_DE_PASSE → on pose le cookie et on nettoie l'URL
  const key = url.searchParams.get("key");
  if (key !== null) {
    const clean = url.clone();
    clean.searchParams.delete("key");
    if (safeEqual(key, process.env.ADSPY_PASSWORD!)) {
      const res = NextResponse.redirect(clean);
      res.cookies.set(AUTH_COOKIE, token, cookieOptions);
      return res;
    }
    clean.pathname = "/login";
    return NextResponse.redirect(clean);
  }

  const cookie = req.cookies.get(AUTH_COOKIE)?.value ?? "";
  if (safeEqual(cookie, token)) return NextResponse.next();

  const login = url.clone();
  login.pathname = "/login";
  login.search = "";
  return NextResponse.redirect(login);
}

export const config = {
  // Tout sauf la page de connexion, les fichiers de Next et l'icône / le manifest de l'app
  matcher: ["/((?!login|_next/|app-icon|manifest.webmanifest|favicon.ico).*)"],
};
