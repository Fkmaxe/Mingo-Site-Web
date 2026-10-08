import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

const SIZES = new Set([192, 512]);

/** App icons generated at build time from the logo, on the posters' gradient. */
export function generateStaticParams() {
  return [...SIZES].map((size) => ({ size: String(size) }));
}

export async function GET(_: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (!SIZES.has(size)) return new Response("Icône inconnue", { status: 404 });
  const logo = await readFile(join(process.cwd(), "src/app/icons/[size]/logo-icon.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  // Maskable icons keep their content in the central 80%: the logo stays well inside it.
  const width = Math.round(size * 0.74);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #c13a85 0%, #6a3fb5 55%, #2b4fdb 100%)",
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: ImageResponse renders plain img only. */}
      <img src={src} width={width} height={Math.round((width * 700) / 744)} alt="" />
    </div>,
    { width: size, height: size },
  );
}
