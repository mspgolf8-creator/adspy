import { ImageResponse } from "next/og";

// Icône de l'app générée à la volée : /app-icon/192, /app-icon/512
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = raw === "192" ? 192 : 512;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-end", color: "white", fontWeight: 800, fontSize: size * 0.56 }}>
          A<span style={{ color: "#bfdbfe" }}>.</span>
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
