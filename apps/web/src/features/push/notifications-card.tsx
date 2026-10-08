"use client";

import { Bell, BellOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { setNewEventsAction, subscribePushAction, unsubscribePushAction } from "./actions";
import {
  base64UrlToBytes,
  deviceSubscription,
  type PushSupport,
  pushSupport,
  toApiSubscription,
  workerRegistration,
} from "./browser";

type Props = { publicKey: string | null; newEvents: boolean };

type DeviceState = "checking" | "on" | "off" | PushSupport;

/** Turns notifications on or off for this device, and the "new events" preference. */
export function NotificationsCard({ publicKey, newEvents }: Props) {
  const router = useRouter();
  const [device, setDevice] = useState<DeviceState>("checking");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Device capabilities only exist in the browser (not data from the API).
  useEffect(() => {
    const support = pushSupport();
    if (support !== "supported") {
      setDevice(support);
      return;
    }
    void workerRegistration().then(async (registration) => {
      if (!registration) return setDevice("no-worker");
      setDevice((await deviceSubscription()) ? "on" : "off");
    });
  }, []);

  const turnOn = () =>
    startTransition(async () => {
      setMessage(null);
      if (!publicKey) return;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setMessage(
          "Notifications refusées. Autorise-les dans les réglages du navigateur pour ce site, puis réessaie.",
        );
        return;
      }
      const registration = await workerRegistration();
      if (!registration) return setDevice("no-worker");
      try {
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(publicKey),
        });
        const body = toApiSubscription(subscription);
        if (!body) throw new Error("Abonnement incomplet");
        const result = await subscribePushAction({ ...body, newEvents });
        if (!result.ok) {
          await subscription.unsubscribe();
          setMessage(result.message);
          return;
        }
        setDevice("on");
        router.refresh();
      } catch {
        setMessage("Impossible d'activer les notifications sur cet appareil.");
      }
    });

  const turnOff = () =>
    startTransition(async () => {
      setMessage(null);
      const subscription = await deviceSubscription();
      if (subscription) {
        await unsubscribePushAction(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setDevice("off");
      router.refresh();
    });

  const toggleNewEvents = (value: boolean) =>
    startTransition(async () => {
      const result = await setNewEventsAction(value);
      if (!result.ok) setMessage(result.message);
      router.refresh();
    });

  let body: React.ReactNode;
  if (!publicKey) {
    body = (
      <CardDescription>Les notifications ne sont pas encore activées pour le site.</CardDescription>
    );
  } else if (device === "install-first") {
    body = (
      <CardDescription>
        Sur iPhone, ajoute d'abord l'appli à l'écran d'accueil (Partager → « Sur l'écran d'accueil
        »), puis ouvre-la depuis l'icône pour activer les notifications.
      </CardDescription>
    );
  } else if (device === "unsupported") {
    body = <CardDescription>Ce navigateur ne gère pas les notifications.</CardDescription>;
  } else if (device === "no-worker") {
    body = (
      <CardDescription>
        Recharge la page puis réessaie : l'appli finit de s'installer sur cet appareil.
      </CardDescription>
    );
  } else if (device === "checking") {
    body = <CardDescription>Vérification de cet appareil…</CardDescription>;
  } else {
    const on = device === "on";
    body = (
      <>
        <CardDescription>
          {on
            ? "Activées sur cet appareil : place libérée, rappel la veille, événement annulé."
            : "Reçois une alerte quand une place se libère, la veille d'un événement ou s'il est annulé."}
        </CardDescription>
        {on ? (
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={newEvents}
              disabled={pending}
              onChange={(e) => toggleNewEvents(e.target.checked)}
            />
            Me prévenir des nouveaux événements
          </label>
        ) : null}
        <Button
          variant={on ? "outline" : "default"}
          size="lg"
          disabled={pending}
          onClick={on ? turnOff : turnOn}
        >
          {on ? <BellOff aria-hidden /> : <Bell aria-hidden />}
          {on ? "Désactiver sur cet appareil" : "Activer les notifications"}
        </Button>
      </>
    );
  }

  return (
    <Card>
      <CardTitle>Notifications</CardTitle>
      {body}
      {message ? <FormAlert tone="error">{message}</FormAlert> : null}
    </Card>
  );
}
