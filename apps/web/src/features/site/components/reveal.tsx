"use client";

import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type RevealProps = {
  readonly children: ReactNode;
  /** Delay in milliseconds, to cascade sibling elements. */
  readonly delay?: number | undefined;
  readonly className?: string | undefined;
  readonly as?: "div" | "li" | undefined;
};

/**
 * Fade and slight slide when the element enters the viewport, once. The server HTML is visible:
 * the CSS only hides `data-reveal="pending"` once `RevealInit` has marked <html>, so without
 * JavaScript the content simply shows. Reduced motion is handled in CSS.
 */
export function Reveal({ children, delay = 0, className, as = "div" }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "-80px 0px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const props = {
    "data-reveal": shown ? "shown" : "pending",
    style: delay ? ({ "--reveal-delay": `${delay}ms` } as CSSProperties) : undefined,
    className: cn(className),
  };
  return as === "li" ? (
    <li
      ref={(node) => {
        ref.current = node;
      }}
      {...props}
    >
      {children}
    </li>
  ) : (
    <div
      ref={(node) => {
        ref.current = node;
      }}
      {...props}
    >
      {children}
    </div>
  );
}

/** Marks <html> before the first paint so `Reveal` may hide pending blocks (no flash). */
const REVEAL_INIT = `if("IntersectionObserver" in window)document.documentElement.setAttribute("data-reveal-ready","")`;

export function RevealInit() {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: constant inline script, no user data.
  return <script dangerouslySetInnerHTML={{ __html: REVEAL_INIT }} />;
}
