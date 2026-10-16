import { DOCUMENT_FILE_TYPES, type DocumentFileType } from "@bde/shared";

/**
 * openapi-fetch options sending a file's raw bytes (uploads), not JSON. The API reads the real
 * type from the bytes: `type` only describes the body.
 */
export async function rawBody(file: Blob, type: string) {
  return {
    body: new Uint8Array(await file.arrayBuffer()) as unknown as string,
    bodySerializer: (body: string) => body as unknown as BodyInit,
    headers: { "content-type": type },
  };
}

/** Office types by extension, for browsers that give no type (or a generic one). */
const TYPE_BY_EXTENSION: Record<string, DocumentFileType> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  doc: "application/msword",
  xls: "application/vnd.ms-excel",
  ppt: "application/vnd.ms-powerpoint",
  txt: "text/plain",
  csv: "text/csv",
  pdf: "application/pdf",
};

/** The document type of a file: the browser's, else its extension's, else PDF. */
export function documentType(file: Blob, name: string): DocumentFileType {
  const declared = file.type.split(";")[0] ?? "";
  if ((DOCUMENT_FILE_TYPES as readonly string[]).includes(declared)) {
    return declared as DocumentFileType;
  }
  return TYPE_BY_EXTENSION[name.split(".").pop()?.toLowerCase() ?? ""] ?? "application/pdf";
}

/** The `file` of an upload form and its `name` (trimmed, 200 characters), or null. */
export function readUpload(form: FormData, fallbackName: string) {
  const file = form.get("file");
  if (!(file instanceof Blob)) return null;
  const raw = form.get("name");
  const name = typeof raw === "string" && raw.trim() ? raw.trim() : fallbackName;
  return { file, name: name.slice(0, 200) };
}
