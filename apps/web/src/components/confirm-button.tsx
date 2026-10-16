"use client";

import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * A destructive action in two taps: the first one asks, the second one does it (a mis-tap on a
 * phone deletes nothing). `children` is the first button's content, icon only or text.
 */
export function ConfirmButton({
  children,
  confirmLabel,
  onConfirm,
  disabled,
  variant = "ghost",
  size,
  "aria-label": ariaLabel,
  className,
}: {
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  variant?: "ghost" | "outline";
  size?: "icon" | "sm" | "default";
  "aria-label"?: string;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  if (asking) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <Button
          size="sm"
          variant="destructive"
          disabled={disabled}
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAsking(false)}>
          Annuler
        </Button>
      </span>
    );
  }
  return (
    <Button
      variant={variant}
      size={size}
      aria-label={ariaLabel}
      className={className}
      disabled={disabled}
      onClick={() => setAsking(true)}
    >
      {children}
    </Button>
  );
}
