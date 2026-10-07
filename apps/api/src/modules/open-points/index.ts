import { on } from "../../core/events";
import { onCheckinRecorded } from "./open-points.service";

export { yearLedger } from "./open-points.service";

on("checkin.recorded", onCheckinRecorded);

export { createOpenPointsRouter } from "./open-points.routes";
