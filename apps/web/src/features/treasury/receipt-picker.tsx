"use client";

import { RECEIPT_MAX_BYTES, RECEIPTS_PER_TRANSACTION } from "@bde/shared";
import { FileText, Paperclip, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { resizePhoto } from "@/lib/resize-photo";
import { uploadAttachmentAction } from "./actions";

/** A receipt chosen in the browser, ready to send: photos are already resized. */
export type PendingReceipt = { key: string; file: Blob; name: string };

const isPdf = (file: Blob) => file.type === "application/pdf";

/** Photos are shrunk (a receipt stays readable at 2000 px); a PDF is sent as is. */
async function prepare(file: File): Promise<PendingReceipt> {
  const key = `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`;
  if (file.type === "application/pdf") {
    if (file.size > RECEIPT_MAX_BYTES) throw new Error(`« ${file.name} » dépasse 8 Mo.`);
    return { key, file, name: file.name };
  }
  if (!file.type.startsWith("image/")) {
    throw new Error(`« ${file.name} » n'est ni une photo ni un PDF.`);
  }
  try {
    const blob = await resizePhoto(file, { maxSide: 2000, quality: 0.85 });
    return { key, file: blob, name: `${file.name.replace(/\.[^.]+$/, "")}.jpg` };
  } catch {
    throw new Error(`« ${file.name} » ne peut pas être lue. Essaie une autre photo.`);
  }
}

/** Sends the receipts one by one; returns the error messages of those that failed. */
export async function uploadReceipts(
  transactionId: string,
  receipts: readonly PendingReceipt[],
): Promise<string[]> {
  const errors: string[] = [];
  for (const receipt of receipts) {
    const form = new FormData();
    form.set("file", receipt.file, receipt.name);
    form.set("name", receipt.name);
    const result = await uploadAttachmentAction(transactionId, form);
    if (!result.ok) errors.push(`${receipt.name} : ${result.message}`);
  }
  return errors;
}

function Preview({ receipt }: { receipt: PendingReceipt }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (isPdf(receipt.file)) return;
    const objectUrl = URL.createObjectURL(receipt.file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [receipt.file]);
  return url ? (
    // biome-ignore lint/performance/noImgElement: local preview (object URL).
    <img src={url} alt="" className="size-12 shrink-0 rounded-lg bg-muted object-cover" />
  ) : (
    <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      <FileText aria-hidden className="size-6" />
    </span>
  );
}

/**
 * Payment receipts to attach: several photos (camera or gallery) and PDF, previewed before
 * sending. `already` counts the receipts the entry has, for the limit of 10.
 */
export function ReceiptPicker({
  receipts,
  onChange,
  already = 0,
}: {
  receipts: PendingReceipt[];
  onChange: (receipts: PendingReceipt[]) => void;
  already?: number;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const room = RECEIPTS_PER_TRANSACTION - already - receipts.length;

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="sr-only"
        aria-label="Ajouter des justificatifs"
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = "";
          if (files.length === 0) return;
          setReading(true);
          const problems: string[] = [];
          if (files.length > room) {
            problems.push(`${RECEIPTS_PER_TRANSACTION} justificatifs au plus par écriture.`);
          }
          const results = await Promise.allSettled(files.slice(0, Math.max(room, 0)).map(prepare));
          const ready: PendingReceipt[] = [];
          for (const result of results) {
            if (result.status === "fulfilled") ready.push(result.value);
            else problems.push(result.reason instanceof Error ? result.reason.message : "Erreur.");
          }
          setErrors(problems);
          setReading(false);
          onChange([...receipts, ...ready]);
        }}
      />
      {receipts.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {receipts.map((receipt) => (
            <li
              key={receipt.key}
              className="flex items-center gap-3 rounded-xl border bg-card p-2 text-sm"
            >
              <Preview receipt={receipt} />
              <span className="min-w-0 flex-1 truncate">{receipt.name}</span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={`Retirer ${receipt.name}`}
                onClick={() => onChange(receipts.filter((r) => r.key !== receipt.key))}
              >
                <X aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {room > 0 ? (
        <Button
          type="button"
          variant="outline"
          className="self-start"
          disabled={reading}
          onClick={() => input.current?.click()}
        >
          <Paperclip aria-hidden />
          {reading ? "Préparation…" : "Ajouter des justificatifs"}
        </Button>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Photos ou PDF, 8 Mo au plus chacun, {RECEIPTS_PER_TRANSACTION} par écriture.
      </p>
      {errors.map((message) => (
        <p key={message} className="text-destructive text-sm">
          {message}
        </p>
      ))}
    </div>
  );
}
