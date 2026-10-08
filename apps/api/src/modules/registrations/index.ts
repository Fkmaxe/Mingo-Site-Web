import { on } from "../../core/events";
import { onEventCancelled, onEventUpdated } from "./registrations.service";

on("event.updated", onEventUpdated);
on("event.cancelled", onEventCancelled);

export { createRegistrationsRouter } from "./registrations.routes";
export {
  allRegistrants,
  confirmedCount,
  type Participant,
  participantByToken,
  participantOfEvent,
  searchParticipants,
  sendRegistrationReminders,
} from "./registrations.service";
export { createTeamsRouter } from "./teams.routes";
