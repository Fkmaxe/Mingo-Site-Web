import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  createDiskPhotoStore,
  createDiskReceiptStore,
  createMemoryReceiptStore,
  sniffPhotoType,
  sniffReceiptType,
  sniffTaskFileType,
} from "./photo-store";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PDF = new TextEncoder().encode("%PDF-1.7\n%âãÏÓ\n");

describe("photos", () => {
  it("recognises images by their bytes, not by what the browser says", () => {
    expect(sniffPhotoType(JPEG)).toBe("image/jpeg");
    expect(sniffPhotoType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe("image/png");
    const webp = new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ");
    expect(sniffPhotoType(webp)).toBe("image/webp");
    expect(sniffPhotoType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  it("only reads names it generated, of its own types (no path traversal)", async () => {
    const store = createMemoryReceiptStore();
    expect(await store.read("../../.env")).toBeNull();
    const name = await store.save(PDF, "application/pdf");
    expect(name).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    expect((await store.read(name))?.type).toBe("application/pdf");
    store.files.set("1b4e28ba-2fa1-11d2-883f-0016d3cca427.exe", PDF);
    expect(await store.read("1b4e28ba-2fa1-11d2-883f-0016d3cca427.exe")).toBeNull();
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

describe("receipts", () => {
  it("accept photos and PDF, recognised by their bytes", () => {
    expect(sniffReceiptType(PDF)).toBe("application/pdf");
    expect(sniffReceiptType(JPEG)).toBe("image/jpeg");
    expect(sniffReceiptType(new TextEncoder().encode("<html>%PDF-"))).toBeNull();
  });

  it("are saved on disk with their extension, and a photo store refuses them", async () => {
    const dir = await mkdtemp(join(tmpdir(), "receipts-"));
    const receipts = createDiskReceiptStore(dir);
    const name = await receipts.save(PDF, "application/pdf");
    expect((await receipts.read(name))?.bytes).toEqual(PDF);
    expect(await createDiskPhotoStore(dir).read(name)).toBeNull();
    await rm(dir, { recursive: true, force: true });
  });
});

describe("sniffTaskFileType", () => {
  const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const zipWith = (folder: string) =>
    new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode(`${folder}workbook.xml`)]);

  it("recognises photos and PDF by their bytes, whatever the declared type", () => {
    expect(sniffTaskFileType(PDF, "text/plain")).toBe("application/pdf");
    expect(sniffTaskFileType(JPEG, XLSX)).toBe("image/jpeg");
  });

  it("keeps a declared office or text type only if the bytes match", () => {
    expect(sniffTaskFileType(zipWith("xl/"), XLSX)).toBe(XLSX);
    expect(sniffTaskFileType(zipWith("word/"), XLSX)).toBeNull();
    const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]);
    expect(sniffTaskFileType(ole, "application/msword")).toBe("application/msword");
    expect(sniffTaskFileType(new TextEncoder().encode("nom;prénom\n"), "text/csv")).toBe(
      "text/csv",
    );
    expect(sniffTaskFileType(new Uint8Array([0x61, 0, 0x62]), "text/plain")).toBeNull();
    expect(sniffTaskFileType(new Uint8Array([0xff, 0xfe, 0x41]), "text/plain")).toBeNull();
    expect(sniffTaskFileType(new TextEncoder().encode("<html>"), "text/html")).toBeNull();
  });
});
