import QRCode from "qrcode";

/** QR code drawn as one SVG path (server-rendered, no script, no innerHTML). */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { size, data } = QRCode.create(value, { errorCorrectionLevel: "M" }).modules;
  const quiet = 4;
  let path = "";
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[y * size + x]) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }
  }
  const total = size + quiet * 2;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering="crispEdges"
      className="aspect-square w-full rounded-xl bg-white"
    >
      <path d={path} fill="black" />
    </svg>
  );
}
