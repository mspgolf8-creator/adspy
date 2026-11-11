/** Message lisible pour n'importe quelle erreur (Error, erreur Supabase {message}, etc.). */
export function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
  return String(e);
}
