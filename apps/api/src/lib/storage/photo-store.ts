import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type PhotoType = "image/jpeg" | "image/png" | "image/webp";

/** Stored photos (inventory). Implementations: a directory on disk, in-memory in tests. */
export interface PhotoStore {
  /** Saves the bytes under a new name and returns it. */
  save(bytes: Uint8Array, type: PhotoType): Promise<string>;
  read(name: string): Promise<{ bytes: Uint8Array; type: PhotoType } | null>;
  remove(name: string): Promise<void>;
}

const EXTENSIONS: Record<PhotoType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Names are generated here: anything else is refused (no path traversal). */
const NAME = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export function typeOfName(name: string): PhotoType | null {
  if (!NAME.test(name)) return null;
  const ext = name.split(".").pop();
  return (Object.entries(EXTENSIONS).find(([, e]) => e === ext)?.[0] as PhotoType) ?? null;
}

/** The real type, read from the first bytes: the browser's claim is not trusted. */
export function sniffPhotoType(bytes: Uint8Array): PhotoType | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if ([0x89, 0x50, 0x4e, 0x47].every((b, i) => bytes[i] === b)) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}

export function createDiskPhotoStore(directory: string): PhotoStore {
  const ready = mkdir(directory, { recursive: true });
  return {
    async save(bytes, type) {
      await ready;
      const name = `${randomUUID()}.${EXTENSIONS[type]}`;
      await writeFile(join(directory, name), bytes, { flag: "wx" });
      return name;
    },
    async read(name) {
      const type = typeOfName(name);
      if (!type) return null;
      try {
        return { bytes: new Uint8Array(await readFile(join(directory, name))), type };
      } catch {
        return null;
      }
    },
    async remove(name) {
      if (typeOfName(name)) await rm(join(directory, name), { force: true });
    },
  };
}

export type MemoryPhotoStore = PhotoStore & { files: Map<string, Uint8Array> };

export function createMemoryPhotoStore(): MemoryPhotoStore {
  const files = new Map<string, Uint8Array>();
  return {
    files,
    async save(bytes, type) {
      const name = `${randomUUID()}.${EXTENSIONS[type]}`;
      files.set(name, bytes);
      return name;
    },
    async read(name) {
      const type = typeOfName(name);
      const bytes = files.get(name);
      return type && bytes ? { bytes, type } : null;
    },
    async remove(name) {
      files.delete(name);
    },
  };
}
