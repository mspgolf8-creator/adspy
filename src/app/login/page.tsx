import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, cookieOptions, safeEqual, sessionToken } from "@/lib/auth";

async function login(formData: FormData) {
  "use server";
  const password = String(formData.get("password") ?? "");
  if (!process.env.ADSPY_PASSWORD || !safeEqual(password, process.env.ADSPY_PASSWORD)) {
    redirect("/login?erreur=1");
  }
  (await cookies()).set(AUTH_COOKIE, await sessionToken(), cookieOptions);
  redirect("/");
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const { erreur } = await searchParams;
  return (
    <form action={login} className="mx-auto mt-24 flex max-w-sm flex-col gap-3 rounded-xl border border-white/10 bg-[#141418] p-6">
      <h1 className="text-lg font-semibold">Adspy</h1>
      <input
        type="password"
        name="password"
        placeholder="Mot de passe"
        autoFocus
        className="rounded-md border border-white/15 bg-[#141418] px-3 py-2 outline-none focus:border-blue-500"
      />
      {erreur && <p className="text-sm text-red-400">Mauvais mot de passe.</p>}
      <button className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">Entrer</button>
    </form>
  );
}
