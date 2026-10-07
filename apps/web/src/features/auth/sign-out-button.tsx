"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { clearOfflinePages } from "@/features/pwa/service-worker-register";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="lg"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await authClient.signOut();
          await clearOfflinePages();
          router.push("/login");
          router.refresh();
        })
      }
    >
      <LogOut aria-hidden />
      Se déconnecter
    </Button>
  );
}
