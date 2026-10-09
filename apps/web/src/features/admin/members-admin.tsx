"use client";

import { Crown, Plus, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { FieldShell, FormAlert } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { BOARD_POSITION_LABELS, MEMBERSHIP_ROLE_LABELS } from "@/lib/labels";
import { removeMembershipAction, setAdminAction, setMembershipAction } from "./actions";
import type { AdminUser, Pole } from "./types";
import { useAction } from "./use-action";

type Role = "member" | "pole_lead" | "board";
type Position = keyof typeof BOARD_POSITION_LABELS;

function membershipLabel(m: AdminUser["memberships"][number]): string {
  if (m.role === "board") {
    return m.boardPosition ? `Bureau · ${BOARD_POSITION_LABELS[m.boardPosition]}` : "Bureau";
  }
  return `${MEMBERSHIP_ROLE_LABELS[m.role]} · ${m.pole?.name ?? "?"}`;
}

function AddRoleForm({
  user,
  poles,
  onClose,
}: {
  user: AdminUser;
  poles: Pole[];
  onClose: () => void;
}) {
  const { run, pending, error } = useAction();
  const [role, setRole] = useState<Role>("member");
  const [poleId, setPoleId] = useState(poles[0]?.id ?? "");
  const [position, setPosition] = useState<Position | "">("");
  const board = role === "board";
  // One role per pole and one board seat per year: picking an existing one changes it.
  const replaced = user.memberships.find((m) =>
    board ? m.role === "board" : m.role !== "board" && m.pole?.id === poleId,
  );
  return (
    <form
      className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            setMembershipAction({
              userId: user.id,
              role,
              poleId: board ? null : poleId,
              boardPosition: board && position ? position : null,
            }),
          onClose,
        );
      }}
    >
      {error ? <FormAlert tone="error">{error}</FormAlert> : null}
      <FieldShell id={`role-${user.id}`} label="Rôle">
        {(aria) => (
          <NativeSelect {...aria} value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="member">Membre d'un pôle</option>
            <option value="pole_lead">Responsable d'un pôle</option>
            <option value="board">Bureau</option>
          </NativeSelect>
        )}
      </FieldShell>
      {board ? (
        <FieldShell id={`position-${user.id}`} label="Poste au bureau">
          {(aria) => (
            <NativeSelect
              {...aria}
              value={position}
              onChange={(e) => setPosition(e.target.value as Position | "")}
            >
              <option value="">Sans poste</option>
              {Object.entries(BOARD_POSITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          )}
        </FieldShell>
      ) : poles.length === 0 ? (
        <p className="text-muted-foreground text-sm">Crée d'abord un pôle (onglet Pôles).</p>
      ) : (
        <FieldShell id={`pole-${user.id}`} label="Pôle">
          {(aria) => (
            <NativeSelect {...aria} value={poleId} onChange={(e) => setPoleId(e.target.value)}>
              {poles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FieldShell>
      )}
      {replaced ? (
        <p className="text-muted-foreground text-xs">
          Remplace « {membershipLabel(replaced)} » : une personne a un seul rôle par pôle et un seul
          poste au bureau. Ses autres rôles sont gardés.
        </p>
      ) : user.memberships.length > 0 ? (
        <p className="text-muted-foreground text-xs">S'ajoute à ses rôles actuels.</p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={pending || (!board && !poleId)}>
          {pending ? "Un instant…" : replaced ? "Remplacer ce rôle" : "Ajouter ce rôle"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Annuler
        </Button>
      </div>
    </form>
  );
}

function UserCard({ user, poles, meId }: { user: AdminUser; poles: Pole[]; meId: string }) {
  const { run, pending, error } = useAction();
  const [adding, setAdding] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const self = user.id === meId;

  return (
    <li className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-primary/5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col">
          <span className="flex items-center gap-1.5 font-semibold">
            {user.name}
            {user.isAdmin ? (
              <ShieldCheck aria-label="Administrateur" className="size-4 text-primary" />
            ) : null}
          </span>
          <span className="truncate text-muted-foreground text-xs">
            {user.email}
            {user.promo ? ` · ${user.promo}` : ""}
          </span>
          <span className="text-muted-foreground text-xs">
            Compte créé le {new Date(user.createdAt).toLocaleDateString("fr-FR")}
            {user.emailVerified ? null : (
              <span className="ml-1.5 rounded-full bg-warning/15 px-2 py-0.5 font-semibold text-warning">
                Adresse non confirmée
              </span>
            )}
          </span>
        </div>
        {self ? (
          <span className="shrink-0 text-muted-foreground text-xs">C'est toi</span>
        ) : confirm === "admin" ? (
          <div className="flex shrink-0 gap-1">
            <Button
              size="sm"
              variant={user.isAdmin ? "destructive" : "default"}
              disabled={pending}
              onClick={() =>
                run(
                  () => setAdminAction(user.id, !user.isAdmin),
                  () => setConfirm(null),
                )
              }
            >
              Confirmer
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
              Non
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0"
            onClick={() => setConfirm("admin")}
          >
            {user.isAdmin ? "Retirer admin" : "Nommer admin"}
          </Button>
        )}
      </div>

      {error ? <FormAlert tone="error">{error}</FormAlert> : null}

      {user.memberships.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {user.memberships.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-1 rounded-full bg-secondary py-1 pr-1 pl-3 font-semibold text-secondary-foreground text-xs"
            >
              {m.role === "board" ? <Crown aria-hidden className="size-3.5" /> : null}
              {membershipLabel(m)}
              {confirm === m.id ? (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => removeMembershipAction(m.id),
                      () => setConfirm(null),
                    )
                  }
                  className="ml-1 rounded-full bg-destructive px-2 py-0.5 text-white"
                >
                  Retirer ?
                </button>
              ) : (
                <button
                  type="button"
                  aria-label={`Retirer le rôle ${membershipLabel(m)}`}
                  onClick={() => setConfirm(m.id)}
                  className="flex size-6 items-center justify-center rounded-full hover:bg-black/10"
                >
                  <X aria-hidden className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-xs">Aucun rôle cette année.</p>
      )}

      {adding ? (
        <AddRoleForm user={user} poles={poles} onClose={() => setAdding(false)} />
      ) : (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setAdding(true)}>
          <Plus aria-hidden />
          Ajouter un rôle
        </Button>
      )}
    </li>
  );
}

export function MembersAdmin({
  users,
  poles,
  meId,
}: {
  users: AdminUser[];
  poles: Pole[];
  meId: string;
}) {
  if (users.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed p-6 text-center text-muted-foreground text-sm">
        Aucun compte ne correspond. La personne doit d'abord créer son compte sur le site.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {users.map((u) => (
        <UserCard key={u.id} user={u} poles={poles} meId={meId} />
      ))}
    </ul>
  );
}
