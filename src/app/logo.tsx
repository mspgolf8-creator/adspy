// Logo de l'adspy : un triangle plein (un « A ») percé d'un œil rond (l'espion)
export const LOGO_PATH = "M12 2.5 22.5 21h-21L12 2.5Zm0 10.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z";

export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d={LOGO_PATH} fillRule="evenodd" />
    </svg>
  );
}
