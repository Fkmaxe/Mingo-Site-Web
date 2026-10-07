import { CreateEventInput, eventDateIssues } from "@bde/shared";
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
};

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
    if (field) add(field, issue.code, issue.message);
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
  return { values: {}, errors };
}
