"use client";

import { LogIn, Menu, UserRound, UserRoundPlus, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import { cn } from "@/lib/utils";
import type { NavItem } from "../content/navigation";
import { siteHref } from "../routes";
import { isActive } from "./main-nav";

/**
 * Mobile menu in a native modal <dialog>: focus stays inside, Escape closes it, and no extra
 * dependency is needed. Following a link closes it (App Router keeps it mounted otherwise).
 */
export function MobileNav({
  items,
  signedIn,
}: {
  readonly items: readonly NavItem[];
  readonly signedIn: boolean;
}) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const close = () => dialog.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        aria-haspopup="dialog"
        aria-label="Ouvrir le menu"
        className="flex size-11 items-center justify-center rounded-full hover:bg-muted lg:hidden"
      >
        <Menu aria-hidden className="size-6" />
      </button>
      <dialog
        ref={dialog}
        aria-label="Menu"
        className="surface-navy m-0 ml-auto h-dvh max-h-none w-full max-w-sm p-0 backdrop:bg-black/50"
      >
        <div className="flex h-full flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <p className="heading-display text-2xl text-on-navy">Menu</p>
            <button
              type="button"
              onClick={close}
              aria-label="Fermer le menu"
              className="flex size-11 items-center justify-center rounded-full text-on-navy hover:bg-on-navy/10"
            >
              <X aria-hidden className="size-6" />
            </button>
          </div>
          <nav aria-label="Navigation mobile">
            <ul className="flex flex-col gap-1">
              {items.map((item) => {
                const target = siteHref(item.route);
                const active = isActive(pathname, target);
                return (
                  <li key={item.route}>
                    <Link
                      href={target}
                      onClick={close}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "heading-display block rounded-lg px-3 py-3 text-2xl",
                        active ? "text-on-navy" : "text-on-navy-muted",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="mt-auto flex flex-col gap-3">
            {signedIn ? (
              <Link
                href="/home"
                onClick={close}
                className="flex h-12 items-center justify-center gap-2 rounded-full bg-on-navy font-semibold text-base text-site-navy"
              >
                <UserRound aria-hidden className="size-5" />
                Mon espace
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={close}
                  className="flex h-12 items-center justify-center gap-2 rounded-full bg-on-navy font-semibold text-base text-site-navy"
                >
                  <LogIn aria-hidden className="size-5" />
                  Se connecter
                </Link>
                <Link
                  href="/signup"
                  onClick={close}
                  className="flex h-12 items-center justify-center gap-2 rounded-full border border-on-navy/40 font-semibold text-base text-on-navy"
                >
                  <UserRoundPlus aria-hidden className="size-5" />
                  Créer mon compte
                </Link>
              </>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
