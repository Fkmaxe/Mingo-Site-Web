"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { withdrawAction } from "./actions";

export function WithdrawButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await withdrawAction();
          router.refresh();
        })
      }
    >
      Retirer ma candidature
    </Button>
  );
}
