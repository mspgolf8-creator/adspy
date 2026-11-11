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
    <form action={login} className="mx-auto mt-24 flex max-w-sm flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
      <h1 className="text-lg font-semibold">Adspy</h1>
      <input
        type="password"
        name="password"
        placeholder="Mot de passe"
        autoFocus
        className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 outline-none focus:border-violet-500"
      />
      {erreur && <p className="text-sm text-red-400">Mauvais mot de passe.</p>}
      <button className="rounded-md bg-violet-500 px-4 py-2 font-medium text-white hover:bg-violet-400">Entrer</button>
    </form>
  );
}
