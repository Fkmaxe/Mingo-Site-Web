"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { ClassForm } from "./class-form";

/** The onboarding's class step: saving it lets the new account in. */
export function WelcomeClass({
  next,
  ...props
}: Omit<ComponentProps<typeof ClassForm>, "onSaved" | "submitLabel"> & { next: string }) {
  const router = useRouter();
  return (
    <ClassForm
      {...props}
      submitLabel="C'est ma classe, on y va"
      onSaved={() => {
        router.push(next);
        router.refresh();
      }}
    />
  );
}
