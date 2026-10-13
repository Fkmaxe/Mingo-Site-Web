/**
 * Shrinks a phone photo before upload (12 MP, 4 MB -> about 200 KB): fast on a weak network,
 * no image library on the server. JPEG, readable everywhere; orientation applied by the browser.
 * `square`: centred square crop (profile photos).
 */
export async function resizePhoto(
  file: File,
  { maxSide = 1600, quality = 0.82, square = false } = {},
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const side = Math.min(bitmap.width, bitmap.height);
  const source = square
    ? { x: (bitmap.width - side) / 2, y: (bitmap.height - side) / 2, w: side, h: side }
    : { x: 0, y: 0, w: bitmap.width, h: bitmap.height };
  const scale = Math.min(1, maxSide / Math.max(source.w, source.h));
  const width = Math.round(source.w * scale);
  const height = Math.round(source.h * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas indisponible");
  context.drawImage(bitmap, source.x, source.y, source.w, source.h, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Photo illisible"))),
      "image/jpeg",
      quality,
    ),
  );
}
