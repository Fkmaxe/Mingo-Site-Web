/** Files people send: task files, application documents. Photos, PDF, office documents, text and CSV. */
export const DOCUMENT_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "text/plain",
  "text/csv",
] as const;
export type DocumentFileType = (typeof DOCUMENT_FILE_TYPES)[number];
export const DOCUMENT_FILE_MAX_BYTES = 10 * 1024 * 1024;
