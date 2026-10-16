import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DOCUMENT_FILE_TYPES, type DocumentFileType } from "@bde/shared";

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
export type DocumentStore = FileStore<DocumentFileType>;

const PHOTO_EXTENSIONS: Record<PhotoType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const RECEIPT_EXTENSIONS: Record<ReceiptType, string> = {
  ...PHOTO_EXTENSIONS,
  "application/pdf": "pdf",
};

const DOCUMENT_EXTENSIONS: Record<DocumentFileType, string> = {
  ...RECEIPT_EXTENSIONS,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/msword": "doc",
  "application/vnd.ms-excel": "xls",
  "application/vnd.ms-powerpoint": "ppt",
  "text/plain": "txt",
  "text/csv": "csv",
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

/** Folder of each Office Open XML type inside its ZIP archive. */
const OOXML_FOLDERS: Partial<Record<DocumentFileType, string>> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "word/",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xl/",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "ppt/",
};
const LEGACY_OFFICE: readonly DocumentFileType[] = [
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
];
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

/**
 * The type of a sent document. Photos and PDF are recognised by their bytes; for the other types the
 * declared one is kept only if the bytes match it: an Office document is a ZIP holding its folder
 * (or an OLE file for the old formats), a text is valid UTF-8 without NUL bytes.
 */
export function sniffDocumentType(bytes: Uint8Array, declared: string): DocumentFileType | null {
  const receipt = sniffReceiptType(bytes);
  if (receipt) return receipt;
  const type = (DOCUMENT_FILE_TYPES as readonly string[]).includes(declared)
    ? (declared as DocumentFileType)
    : null;
  if (!type) return null;
  const folder = OOXML_FOLDERS[type];
  if (folder) {
    const zip = [0x50, 0x4b, 0x03, 0x04].every((b, i) => bytes[i] === b);
    return zip && Buffer.from(bytes).includes(folder, 0, "latin1") ? type : null;
  }
  if (LEGACY_OFFICE.includes(type)) return OLE_MAGIC.every((b, i) => bytes[i] === b) ? type : null;
  if (type === "text/plain" || type === "text/csv") {
    if (bytes.includes(0)) return null;
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return type;
    } catch {
      return null;
    }
  }
  return null;
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
export type MemoryDocumentStore = MemoryFileStore<DocumentFileType>;

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
export const createDiskDocumentStore = (directory: string): DocumentStore =>
  createDiskFileStore(directory, DOCUMENT_EXTENSIONS);
export const createMemoryDocumentStore = (): MemoryDocumentStore =>
  createMemoryFileStore(DOCUMENT_EXTENSIONS);
