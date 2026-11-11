/**
 * Protection par mot de passe de l'adspy en ligne.
 * - ADSPY_PASSWORD vide (en local) : aucune protection.
 * - Sinon : il faut le cookie de session, obtenu via /login ou via ?key=… dans l'URL
 *   (pratique pour l'iframe du CRM : l'onglet s'ouvre sans redemander le mot de passe).
 * Le cookie est « Partitioned » + SameSite=None pour marcher à l'intérieur d'une iframe.
 */
export const AUTH_COOKIE = "adspy_session";

export function authEnabled() {
  return Boolean(process.env.ADSPY_PASSWORD);
}

/** Valeur du cookie : empreinte du mot de passe (change si le mot de passe change). */
export async function sessionToken(): Promise<string> {
  const data = new TextEncoder().encode(`adspy:${process.env.ADSPY_PASSWORD ?? ""}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparaison à temps constant pour éviter de deviner le mot de passe caractère par caractère. */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none" as const,
  partitioned: true,
  path: "/",
  maxAge: 60 * 60 * 24 * 90, // 90 jours
};
