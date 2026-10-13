import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type PhotoType = "image/jpeg" | "image/png" | "image/webp";
export type ReceiptType = PhotoType | "application/pdf";

/**
 * Stored files of the given types. Implementations: a directory on disk, in-memory in tests.
 * Photos (inventory, avatars) and payment receipts (treasury) each have their own store.
 */
export interface FileStore<T extends string> {
  /** Saves the bytes under a new name and returns it. */
  save(bytes: Uint8Array, type: T): Promise<string>;
  read(name: string): Promise<{ bytes: Uint8Array; type: T } | null>;
  remove(name: string): Promise<void>;
}

export type PhotoStore = FileStore<PhotoType>;
export type ReceiptStore = FileStore<ReceiptType>;

const PHOTO_EXTENSIONS: Record<PhotoType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const RECEIPT_EXTENSIONS: Record<ReceiptType, string> = {
  ...PHOTO_EXTENSIONS,
  "application/pdf": "pdf",
};

/** Names are generated here: anything else is refused (no path traversal). */
function typeOfName<T extends string>(extensions: Record<T, string>, name: string): T | null {
  const match = /^[0-9a-f-]{36}\.([a-z]+)$/.exec(name);
  if (!match) return null;
  const entry = (Object.entries(extensions) as [T, string][]).find(([, e]) => e === match[1]);
  return entry?.[0] ?? null;
}

/** The real type, read from the first bytes: the browser's claim is not trusted. */
export function sniffPhotoType(bytes: Uint8Array): PhotoType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([0x89, 0x50, 0x4e, 0x47].every((b, i) => bytes[i] === b)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

/** A photo, or a PDF (it starts with « %PDF- »). */
export function sniffReceiptType(bytes: Uint8Array): ReceiptType | null {
  if (String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-") return "application/pdf";
  return sniffPhotoType(bytes);
}

function createDiskFileStore<T extends string>(
  directory: string,
  extensions: Record<T, string>,
): FileStore<T> {
  const ready = mkdir(directory, { recursive: true });
  return {
    async save(bytes, type) {
      await ready;
      const name = `${randomUUID()}.${extensions[type]}`;
      await writeFile(join(directory, name), bytes, { flag: "wx" });
      return name;
    },
    async read(name) {
      const type = typeOfName(extensions, name);
      if (!type) return null;
      try {
        return { bytes: new Uint8Array(await readFile(join(directory, name))), type };
      } catch {
        return null;
      }
    },
    async remove(name) {
      if (typeOfName(extensions, name)) await rm(join(directory, name), { force: true });
    },
  };
}

export type MemoryFileStore<T extends string> = FileStore<T> & { files: Map<string, Uint8Array> };
export type MemoryPhotoStore = MemoryFileStore<PhotoType>;
export type MemoryReceiptStore = MemoryFileStore<ReceiptType>;

function createMemoryFileStore<T extends string>(
  extensions: Record<T, string>,
): MemoryFileStore<T> {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    async save(bytes, type) {
      const name = `${randomUUID()}.${extensions[type]}`;
      files.set(name, bytes);
      return name;
    },
    async read(name) {
      const type = typeOfName(extensions, name);
      const bytes = files.get(name);
      return type && bytes ? { bytes, type } : null;
    },
    async remove(name) {
      files.delete(name);
    },
  };
}

export const createDiskPhotoStore = (directory: string): PhotoStore =>
  createDiskFileStore(directory, PHOTO_EXTENSIONS);
export const createMemoryPhotoStore = (): MemoryPhotoStore =>
  createMemoryFileStore(PHOTO_EXTENSIONS);
export const createDiskReceiptStore = (directory: string): ReceiptStore =>
  createDiskFileStore(directory, RECEIPT_EXTENSIONS);
export const createMemoryReceiptStore = (): MemoryReceiptStore =>
  createMemoryFileStore(RECEIPT_EXTENSIONS);
