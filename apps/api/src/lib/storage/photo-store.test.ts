import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createDiskPhotoStore, sniffPhotoType, typeOfName } from "./photo-store";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

describe("photos", () => {
  it("recognises images by their bytes, not by what the browser says", () => {
    expect(sniffPhotoType(JPEG)).toBe("image/jpeg");
    expect(sniffPhotoType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe("image/png");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffPhotoType(webp)).toBe("image/webp");
    expect(sniffPhotoType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  it("only reads names it generated (no path traversal)", () => {
    expect(typeOfName("../../.env")).toBeNull();
    expect(typeOfName("1b4e28ba-2fa1-11d2-883f-0016d3cca427.jpg")).toBe("image/jpeg");
  });

  const dirs: string[] = [];
  afterAll(async () => {
    for (const d of dirs) await rm(d, { recursive: true, force: true });
  });

  it("saves, reads and removes on disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "photos-"));
    dirs.push(dir);
    const store = createDiskPhotoStore(join(dir, "uploads"));
    const name = await store.save(JPEG, "image/jpeg");
    expect(name).toMatch(/\.jpg$/);
    expect((await store.read(name))?.bytes).toEqual(JPEG);
    await store.remove(name);
    expect(await store.read(name)).toBeNull();
    expect(await store.read("../../etc/passwd")).toBeNull();
  });
});
