import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/**
 * Home screen icon (iOS): the favicon's logo on the showcase navy, as iOS turns transparency
 * into black. Generated at build time from `icon.png`, so both icons stay the same logo.
 */
export default async function AppleIcon() {
  const logo = await readFile(join(process.cwd(), "src/app/icon.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  const side = Math.round(size.width * 0.86);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b1a30",
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: ImageResponse renders plain img only. */}
      <img src={src} width={side} height={side} alt="" />
    </div>,
    size,
  );
}
