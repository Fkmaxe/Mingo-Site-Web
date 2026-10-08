import {
  CreateEventInput,
  type CustomFieldType,
  eventDateIssues,
  fieldKey,
  teamSizeIssues,
} from "@bde/shared";
import type { FieldErrors, ResolverResult } from "react-hook-form";
import { isoToParisInput, parisInputToIso } from "@/lib/paris-time";
import type { Event } from "./types";

/** Raw form state: everything is a string, as typed in the inputs (dates in Paris time). */
export type EventFormValues = {
  poleId: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  registrationDeadline: string;
  visibility: string;
  capacity: string;
  openPointsValue: string;
  /** Empty: the grade period's default. */
  memberPoints: string;
  /** Both empty: individual registrations. */
  teamMinSize: string;
  teamMaxSize: string;
  customFields: CustomFieldFormValues[];
};

export type CustomFieldFormValues = {
  /** Kept for existing fields (answers are stored under it); empty for new ones. */
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  /** Choices of a select, one per line. */
  options: string;
};

export const emptyCustomField = (): CustomFieldFormValues => ({
  key: "",
  label: "",
  type: "text",
  required: false,
  options: "",
});

/** Existing keys are kept; new fields get a key from their label, made unique. */
function toCustomFields(rows: CustomFieldFormValues[]) {
  const used = new Set(rows.map((r) => r.key).filter(Boolean));
  return rows.map((row) => {
    let key = row.key;
    if (!key) {
      const base = fieldKey(row.label || "champ");
      key = base;
      for (let n = 2; used.has(key); n++) key = `${base.slice(0, 36)}_${n}`;
      used.add(key);
    }
    const options = row.options
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean);
    return {
      key,
      label: row.label,
      type: row.type,
      required: row.required,
      ...(row.type === "select" ? { options } : {}),
    };
  });
}

export function emptyEventForm(poleId = ""): EventFormValues {
  return {
    poleId,
    title: "",
    description: "",
    location: "",
    startsAt: "",
    endsAt: "",
    registrationDeadline: "",
    visibility: "students",
    capacity: "",
    openPointsValue: "0",
    memberPoints: "",
    teamMinSize: "",
    teamMaxSize: "",
    customFields: [],
  };
}

export function eventToForm(event: Event): EventFormValues {
  return {
    poleId: event.pole.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startsAt: isoToParisInput(event.startsAt),
    endsAt: isoToParisInput(event.endsAt),
    registrationDeadline: event.registrationDeadline
      ? isoToParisInput(event.registrationDeadline)
      : "",
    visibility: event.visibility,
    capacity: event.capacity === null ? "" : String(event.capacity),
    openPointsValue: String(event.openPointsValue),
    memberPoints: event.memberPoints === null ? "" : String(event.memberPoints),
    teamMinSize: event.teamMinSize === null ? "" : String(event.teamMinSize),
    teamMaxSize: event.teamMaxSize === null ? "" : String(event.teamMaxSize),
    customFields: event.customFields.map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      options: (f.options ?? []).join("\n"),
    })),
  };
}

/** Form strings -> API input. Invalid values are kept invalid so the schema reports them. */
export function formToInput(values: EventFormValues) {
  const date = (value: string) => parisInputToIso(value) ?? value;
  return {
    poleId: values.poleId,
    title: values.title,
    description: values.description,
    location: values.location,
    startsAt: date(values.startsAt),
    endsAt: date(values.endsAt),
    registrationDeadline: values.registrationDeadline ? date(values.registrationDeadline) : null,
    visibility: values.visibility,
    capacity: values.capacity.trim() === "" ? null : Number(values.capacity),
    openPointsValue: values.openPointsValue.trim() === "" ? 0 : Number(values.openPointsValue),
    posterUrl: null,
    memberPoints:
      values.memberPoints.trim() === "" ? null : Number(values.memberPoints.replace(",", ".")),
    teamMinSize: values.teamMinSize.trim() === "" ? null : Number(values.teamMinSize),
    teamMaxSize: values.teamMaxSize.trim() === "" ? null : Number(values.teamMaxSize),
    customFields: toCustomFields(values.customFields),
  };
}

/** react-hook-form resolver validating with the shared API schema (same rules and messages). */
export function eventFormResolver(values: EventFormValues): ResolverResult<EventFormValues> {
  const input = formToInput(values);
  const result = CreateEventInput.safeParse(input);
  if (result.success) return { values, errors: {} };
  const errors: FieldErrors<EventFormValues> = {};
  const add = (field: keyof EventFormValues, type: string, message: string) => {
    if (!errors[field]) errors[field] = { type, message };
  };
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof EventFormValues | undefined;
    if (field === "customFields") {
      const index = issue.path[1];
      if (!errors.customFields) {
        errors.customFields = {
          type: issue.code,
          message:
            typeof index === "number" ? `Champ ${index + 1} : ${issue.message}` : issue.message,
        };
      }
    } else if (field) {
      add(field, issue.code, issue.message);
    }
  }
  // Zod skips refinements while other fields are invalid: report date issues at once.
  const validDate = (iso: string | null) =>
    iso && !Number.isNaN(Date.parse(iso)) ? iso : undefined;
  for (const issue of eventDateIssues({
    startsAt: validDate(input.startsAt),
    endsAt: validDate(input.endsAt),
    registrationDeadline: validDate(input.registrationDeadline),
  })) {
    add(issue.path, "custom", issue.message);
  }
  const validSize = (n: number | null) => (n !== null && Number.isInteger(n) ? n : null);
  for (const issue of teamSizeIssues({
    teamMinSize: validSize(input.teamMinSize),
    teamMaxSize: validSize(input.teamMaxSize),
  })) {
    add(issue.path, "custom", issue.message);
  }
  return { values: {}, errors };
}
