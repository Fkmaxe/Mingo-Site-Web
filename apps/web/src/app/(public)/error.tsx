"use client";

import { PageError } from "@/components/route-states";

export default function ErrorPage(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <PageError {...props} />;
}
