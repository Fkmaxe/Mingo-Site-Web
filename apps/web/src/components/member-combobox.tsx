"use client";

import { X } from "lucide-react";
import { useId, useState } from "react";
import { Avatar } from "@/components/avatar";
import { FieldShell } from "@/components/form-field";
import { cn } from "@/lib/utils";

export type MemberOption = {
  id: string;
  name: string;
  avatarUrl: string | null;
  /** Second line of a suggestion (pole, bureau seat). */
  detail?: string | undefined;
};

/** Case- and accent-insensitive: « eloise » finds « Éloïse ». */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();

const MAX_SUGGESTIONS = 8;

/**
 * Search field over BDE members: suggestions with their photo as one types, keyboard friendly
 * (↑ ↓ Entrée Échap). The chosen member is shown as a chip that can be cleared.
 */
export function MemberCombobox({
  id,
  label,
  members,
  value,
  onChange,
  error,
  hint,
  placeholder = "Rechercher un membre…",
}: {
  id: string;
  label: string;
  members: MemberOption[];
  value: string | null;
  onChange: (memberId: string | null) => void;
  error?: string | undefined;
  hint?: string | undefined;
  placeholder?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = members.find((m) => m.id === value) ?? null;
  const words = fold(query).split(/\s+/).filter(Boolean);
  const suggestions = members
    .filter((m) => words.every((w) => fold(`${m.name} ${m.detail ?? ""}`).includes(w)))
    .slice(0, MAX_SUGGESTIONS);
  const expanded = open && suggestions.length > 0;
  const optionId = (index: number) => `${listId}-${index}`;

  const choose = (member: MemberOption) => {
    onChange(member.id);
    setQuery("");
    setOpen(false);
  };

  return (
    <FieldShell id={id} label={label} error={error} hint={hint}>
      {(aria) =>
        selected ? (
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-input bg-card py-1 pr-1 pl-1.5">
            <Avatar name={selected.name} url={selected.avatarUrl} size={32} />
            <span className="min-w-0 flex-1 truncate font-medium text-sm">{selected.name}</span>
            <button
              id={id}
              type="button"
              aria-label={`Retirer ${selected.name}`}
              aria-describedby={aria["aria-describedby"]}
              onClick={() => onChange(null)}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              {...aria}
              type="text"
              role="combobox"
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={expanded}
              aria-controls={listId}
              aria-activedescendant={expanded ? optionId(active) : undefined}
              placeholder={placeholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setOpen(false)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setOpen(true);
                  setActive((i) => Math.min(i + 1, suggestions.length - 1));
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) => Math.max(i - 1, 0));
                } else if (e.key === "Enter" && expanded) {
                  e.preventDefault();
                  const member = suggestions[active];
                  if (member) choose(member);
                } else if (e.key === "Escape") {
                  setOpen(false);
                }
              }}
              className="flex h-11 w-full min-w-0 rounded-xl border border-input bg-card px-3 py-2 text-base outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
            />
            {expanded ? (
              <div
                id={listId}
                role="listbox"
                aria-label={label}
                className="absolute inset-x-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-xl border bg-card p-1 shadow-lg"
              >
                {suggestions.map((member, index) => (
                  <div
                    key={member.id}
                    id={optionId(index)}
                    role="option"
                    // The focus stays in the field (aria-activedescendant); reachable by script only.
                    tabIndex={-1}
                    aria-selected={index === active}
                    // Keeps the focus in the field: the click would otherwise blur it first.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(member)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") choose(member);
                    }}
                    onMouseEnter={() => setActive(index)}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5",
                      index === active && "bg-muted",
                    )}
                  >
                    <Avatar name={member.name} url={member.avatarUrl} size={32} />
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium text-sm">{member.name}</span>
                      {member.detail ? (
                        <span className="truncate text-muted-foreground text-xs">
                          {member.detail}
                        </span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )
      }
    </FieldShell>
  );
}
