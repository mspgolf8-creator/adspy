import { IconStar } from "./icons";

/** Pastille d'étoiles : vert pour 3 à 5, jaune pour 2, rouge pour 1. */
export function Stars({ n }: { n: number | null }) {
  if (!n) return null;
  const tone =
    n >= 3 ? "bg-[#0f3a22] text-[#22c55e]" : n === 2 ? "bg-[#3a3410] text-[#eab308]" : "bg-[#3d1414] text-[#ef4444]";
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 ${tone}`} title={`${n} étoile${n > 1 ? "s" : ""}`}>
      {Array.from({ length: n }, (_, i) => <IconStar key={i} className="h-3.5 w-3.5" />)}
      {n <= 2 && Array.from({ length: 5 - n }, (_, i) => (
        <span key={`d${i}`} className="mx-[3px] h-1 w-1 rounded-full bg-zinc-500/70" />
      ))}
    </span>
  );
}
