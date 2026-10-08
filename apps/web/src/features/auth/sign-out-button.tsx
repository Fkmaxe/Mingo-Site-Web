"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { unsubscribePushAction } from "@/features/push/actions";
import { deviceSubscription } from "@/features/push/browser";
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
          // A shared device must not keep receiving this account's notifications.
          const subscription = await deviceSubscription().catch(() => null);
          if (subscription) {
            await unsubscribePushAction(subscription.endpoint).catch(() => undefined);
            await subscription.unsubscribe().catch(() => false);
          }
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
