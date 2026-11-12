import { ImageResponse } from "next/og";
import { LOGO_PATH } from "../../logo";

// Icône de l'app générée à la volée : /app-icon/192, /app-icon/512 (fond noir, logo blanc)
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = raw === "192" ? 192 : 512;
  const mark = Math.round(size * 0.5); // marge large : l'icône reste entière même en mode « maskable »
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0d0d10" }}>
        <svg width={mark} height={mark} viewBox="0 0 24 24">
          <path d={LOGO_PATH} fill="#ffffff" fillRule="evenodd" />
        </svg>
      </div>
    ),
    { width: size, height: size },
  );
}
