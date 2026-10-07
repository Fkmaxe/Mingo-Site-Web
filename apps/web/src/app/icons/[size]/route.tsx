import { ImageResponse } from "next/og";

const SIZES = new Set([192, 512]);

/** App icons generated at build time (no binary file to maintain). */
export function generateStaticParams() {
  return [...SIZES].map((size) => ({ size: String(size) }));
}

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("Icône inconnue", { status: 404 });
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#4338ca",
        color: "#ffffff",
        fontSize: size * 0.42,
        fontWeight: 800,
        letterSpacing: -size * 0.02,
      }}
    >
      BM
    </div>,
    { width: size, height: size },
  );
}
