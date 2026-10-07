"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveGradeAction } from "./actions";
import { formatScore, GRADE_STATUS_LABELS } from "./labels";
import type { MemberGrade } from "./types";

/** One member: presence (computed), pole points and comment (editable), final grade. */
export function GradeRow({
  periodId,
  grade,
  scaleMax,
  canEditFrozen,
}: {
  periodId: string;
  grade: MemberGrade;
  scaleMax: number;
  canEditFrozen: boolean;
}) {
  const [points, setPoints] = useState(String(grade.involvementPoints));
  const [comment, setComment] = useState(grade.comment);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const frozen = grade.status === "validated" || grade.status === "published";
  const editable = !frozen || canEditFrozen;
  const id = `grade-${grade.membershipId}`;

  const save = () =>
    startTransition(async () => {
      const value = Number(points.replace(",", "."));
      if (!Number.isFinite(value) || value < 0 || value > scaleMax) {
        setMessage({ ok: false, text: `Entre 0 et ${scaleMax} points` });
        return;
      }
      const result = await saveGradeAction(periodId, {
        membershipId: grade.membershipId,
        involvementPoints: value,
        comment,
      });
      setMessage(
        result.ok ? { ok: true, text: "Enregistré" } : { ok: false, text: result.message },
      );
    });

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <span className="font-medium">{grade.user.name}</span>
          <span className="text-muted-foreground text-xs">
            {grade.pole.name} · {GRADE_STATUS_LABELS[grade.status]}
          </span>
        </div>
        <span className="font-bold text-lg text-primary tabular-nums">
          {formatScore(grade.finalScore)}/{scaleMax}
        </span>
      </div>
      <p className="text-muted-foreground text-sm">
        Présence : {formatScore(grade.presencePoints)} pt{grade.presencePoints > 1 ? "s" : ""} (
        {grade.presenceCount} événement{grade.presenceCount > 1 ? "s" : ""})
      </p>
      {editable ? (
        <div className="grid gap-2 sm:grid-cols-[8rem_1fr_auto] sm:items-end">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-points`} className="text-xs">
              Points du pôle
            </label>
            <Input
              id={`${id}-points`}
              inputMode="decimal"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-comment`} className="text-xs">
              Commentaire
            </label>
            <Input
              id={`${id}-comment`}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <Button variant="outline" disabled={pending} onClick={save}>
            Enregistrer
          </Button>
        </div>
      ) : (
        <p className="text-sm">
          Pôle : {formatScore(grade.involvementPoints)} pts
          {grade.comment ? ` · ${grade.comment}` : ""}
        </p>
      )}
      {message ? (
        <p
          role="status"
          className={message.ok ? "text-sm text-success" : "text-destructive text-sm"}
        >
          {message.text}
        </p>
      ) : null}
    </li>
  );
}
