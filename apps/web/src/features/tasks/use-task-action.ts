"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";

/** Runs a server action, keeps its error message and refreshes the page on success. */
export function useTaskAction() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionResult>, onDone?: () => void) =>
    startTransition(async () => {
      const result = await action();
      setError(result.ok ? null : result.message);
      if (result.ok) {
        onDone?.();
        router.refresh();
      }
    });
  return { error, pending, run };
}
