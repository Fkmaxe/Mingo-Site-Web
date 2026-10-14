"use client";

import { ExternalLink, FileText, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { removeAttachmentAction } from "./actions";
import { type PendingReceipt, ReceiptPicker, uploadReceipts } from "./receipt-picker";
import type { Attachment } from "./types";

const sizeLabel = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} Ko`
    : `${(bytes / 1024 / 1024).toFixed(1)} Mo`;

/**
 * Receipts of an entry, shown in the page: photos as thumbnails (full size in a new tab), PDF
 * embedded from md up and opened in a new tab on a phone. The treasurer adds and removes them.
 */
export function Attachments({
  transactionId,
  attachments,
  receiptUrl,
  canManage,
}: {
  transactionId: string;
  attachments: Attachment[];
  /** Link of an entry recorded before receipts were uploaded. */
  receiptUrl: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [adding, setAdding] = useState<PendingReceipt[]>([]);
  const images = attachments.filter((a) => a.contentType !== "application/pdf");
  const pdfs = attachments.filter((a) => a.contentType === "application/pdf");

  const remove = (attachment: Attachment) => {
    if (!window.confirm(`Retirer « ${attachment.name} » ? Le retrait est tracé dans le journal.`)) {
      return;
    }
    startTransition(async () => {
      const result = await removeAttachmentAction(transactionId, attachment.id);
      setErrors(result.ok ? [] : [result.message]);
      router.refresh();
    });
  };
  const send = () =>
    startTransition(async () => {
      const failed = await uploadReceipts(transactionId, adding);
      setErrors(failed);
      setAdding([]);
      router.refresh();
    });

  const removeButton = (attachment: Attachment) =>
    canManage ? (
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={pending}
        aria-label={`Retirer ${attachment.name}`}
        onClick={() => remove(attachment)}
      >
        <Trash2 aria-hidden />
      </Button>
    ) : null;

  return (
    <div className="flex flex-col gap-4">
      {errors.map((message) => (
        <FormAlert key={message} tone="error">
          {message}
        </FormAlert>
      ))}
      {attachments.length === 0 && !receiptUrl ? (
        <p className="rounded-xl border border-dashed p-4 text-center text-muted-foreground text-sm">
          Aucun justificatif.
        </p>
      ) : null}

      {images.length > 0 ? (
        <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {images.map((a) => (
            <li key={a.id} className="flex flex-col gap-1">
              <a
                href={a.url}
                target="_blank"
                rel="noopener"
                className="block overflow-hidden rounded-xl border bg-muted"
              >
                {/* biome-ignore lint/performance/noImgElement: private receipt through the web proxy. */}
                <img
                  src={a.url}
                  alt={`Justificatif ${a.name}`}
                  loading="lazy"
                  className="aspect-[3/4] w-full object-cover"
                />
              </a>
              <span className="flex items-center gap-1 text-xs">
                <span className="min-w-0 flex-1 truncate text-muted-foreground">{a.name}</span>
                {removeButton(a)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {pdfs.map((a) => (
        <div key={a.id} className="flex flex-col gap-2 rounded-2xl border bg-card p-2">
          <div className="flex items-center gap-2 text-sm">
            <FileText aria-hidden className="size-5 shrink-0 text-muted-foreground" />
            <a
              href={a.url}
              target="_blank"
              rel="noopener"
              className="flex min-h-11 min-w-0 flex-1 items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
            >
              <span className="truncate">{a.name}</span>
              <ExternalLink aria-hidden className="size-3.5 shrink-0" />
            </a>
            <span className="shrink-0 text-muted-foreground text-xs">{sizeLabel(a.sizeBytes)}</span>
            {removeButton(a)}
          </div>
          {/* Phones open the PDF in their own viewer; larger screens show it here. */}
          <iframe
            src={a.url}
            title={a.name}
            loading="lazy"
            className="hidden h-[32rem] w-full rounded-xl border bg-muted md:block"
          />
        </div>
      ))}

      {receiptUrl ? (
        <a
          href={receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-11 items-center gap-1 text-primary text-sm underline-offset-4 hover:underline"
        >
          Lien (ancien justificatif)
          <ExternalLink aria-hidden className="size-3.5" />
        </a>
      ) : null}

      {canManage ? (
        <div className="flex flex-col gap-2">
          <ReceiptPicker receipts={adding} onChange={setAdding} already={attachments.length} />
          {adding.length > 0 ? (
            <Button type="button" className="self-start" disabled={pending} onClick={send}>
              {pending
                ? "Envoi…"
                : `Envoyer ${adding.length} justificatif${adding.length > 1 ? "s" : ""}`}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
