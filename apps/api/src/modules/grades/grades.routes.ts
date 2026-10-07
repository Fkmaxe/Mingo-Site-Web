import {
  CreateGradePeriodInput,
  GradeIdsInput,
  GradePeriodDto,
  ListGradesQuery,
  MemberGradeDto,
  MyGradesDto,
  SaveGradeInput,
  SubmitGradesInput,
  UpdateGradePeriodInput,
} from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import {
  createPeriod,
  generateQuarters,
  getMyGrades,
  listGrades,
  listPeriods,
  publishGrades,
  removePeriod,
  saveGrade,
  submitGrades,
  updatePeriod,
  validateGrades,
} from "./grades.service";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});
const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { "application/json": { schema } } },
});
const PeriodParams = z.object({ periodId: z.uuid() });
const Result = z.object({ updated: z.int(), skipped: z.int() }).meta({ id: "BatchResult" });
const errors = {
  400: errorResponse("Données invalides"),
  403: errorResponse("Pas le droit"),
  404: errorResponse("Introuvable"),
  409: errorResponse("Note verrouillée ou conflit"),
};

const listPeriodsRoute = createRoute({
  method: "get",
  path: "/grade-periods",
  tags: ["grades"],
  middleware: [requireAuth] as const,
  responses: { 200: json(z.array(GradePeriodDto), "Périodes de l'année en cours"), ...errors },
});
const createPeriodRoute = createRoute({
  method: "post",
  path: "/grade-periods",
  tags: ["grades"],
  middleware: [requirePermission("grades:validate")] as const,
  request: body(CreateGradePeriodInput),
  responses: { 201: json(GradePeriodDto, "Période créée"), ...errors },
});
const quartersRoute = createRoute({
  method: "post",
  path: "/grade-periods/generate-quarters",
  tags: ["grades"],
  middleware: [requirePermission("grades:validate")] as const,
  responses: { 201: json(z.array(GradePeriodDto), "Trois trimestres créés"), ...errors },
});
const updatePeriodRoute = createRoute({
  method: "patch",
  path: "/grade-periods/{periodId}",
  tags: ["grades"],
  middleware: [requirePermission("grades:validate")] as const,
  request: { params: PeriodParams, ...body(UpdateGradePeriodInput) },
  responses: { 200: json(GradePeriodDto, "Période modifiée"), ...errors },
});
const deletePeriodRoute = createRoute({
  method: "delete",
  path: "/grade-periods/{periodId}",
  tags: ["grades"],
  middleware: [requirePermission("grades:validate")] as const,
  request: { params: PeriodParams },
  responses: { 204: { description: "Période supprimée" }, ...errors },
});
const listGradesRoute = createRoute({
  method: "get",
  path: "/grade-periods/{periodId}/grades",
  tags: ["grades"],
  middleware: [requirePermission("grades:propose")] as const,
  request: { params: PeriodParams, query: ListGradesQuery },
  responses: { 200: json(z.array(MemberGradeDto), "Notes des membres"), ...errors },
});
const saveGradeRoute = createRoute({
  method: "put",
  path: "/grade-periods/{periodId}/grades",
  tags: ["grades"],
  middleware: [requirePermission("grades:propose")] as const,
  request: { params: PeriodParams, ...body(SaveGradeInput) },
  responses: { 200: json(MemberGradeDto, "Note enregistrée"), ...errors },
});
const submitRoute = createRoute({
  method: "post",
  path: "/grade-periods/{periodId}/submit",
  tags: ["grades"],
  middleware: [requirePermission("grades:propose")] as const,
  request: { params: PeriodParams, ...body(SubmitGradesInput) },
  responses: { 200: json(Result, "Brouillons du pôle soumis au bureau"), ...errors },
});
const validateRoute = createRoute({
  method: "post",
  path: "/grades/validate",
  tags: ["grades"],
  middleware: [requirePermission("grades:validate")] as const,
  request: body(GradeIdsInput),
  responses: { 200: json(Result, "Notes validées (figées)"), ...errors },
});
const publishRoute = createRoute({
  method: "post",
  path: "/grades/publish",
  tags: ["grades"],
  middleware: [requirePermission("grades:publish")] as const,
  request: body(GradeIdsInput),
  responses: { 200: json(Result, "Notes publiées"), ...errors },
});
const myGradesRoute = createRoute({
  method: "get",
  path: "/me/grades",
  tags: ["grades"],
  middleware: [requireAuth] as const,
  responses: { 200: json(MyGradesDto, "Mes présences et mes notes publiées"), ...errors },
});

export function createGradesRouter() {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(listPeriodsRoute, async (c) => c.json(await listPeriods(c.get("ctx")), 200))
    .openapi(createPeriodRoute, async (c) =>
      c.json(
        await createPeriod(
          authedCtx(c.get("ctx")),
          CreateGradePeriodInput.parse(c.req.valid("json")),
        ),
        201,
      ),
    )
    .openapi(quartersRoute, async (c) =>
      c.json(await generateQuarters(authedCtx(c.get("ctx"))), 201),
    )
    .openapi(updatePeriodRoute, async (c) =>
      c.json(
        await updatePeriod(
          authedCtx(c.get("ctx")),
          c.req.valid("param").periodId,
          c.req.valid("json"),
        ),
        200,
      ),
    )
    .openapi(deletePeriodRoute, async (c) => {
      await removePeriod(authedCtx(c.get("ctx")), c.req.valid("param").periodId);
      return c.body(null, 204);
    })
    .openapi(listGradesRoute, async (c) =>
      c.json(
        await listGrades(
          authedCtx(c.get("ctx")),
          c.req.valid("param").periodId,
          c.req.valid("query").poleId,
        ),
        200,
      ),
    )
    .openapi(saveGradeRoute, async (c) =>
      c.json(
        await saveGrade(
          authedCtx(c.get("ctx")),
          c.req.valid("param").periodId,
          SaveGradeInput.parse(c.req.valid("json")),
        ),
        200,
      ),
    )
    .openapi(submitRoute, async (c) =>
      c.json(
        await submitGrades(
          authedCtx(c.get("ctx")),
          c.req.valid("param").periodId,
          c.req.valid("json").poleId,
        ),
        200,
      ),
    )
    .openapi(validateRoute, async (c) =>
      c.json(await validateGrades(authedCtx(c.get("ctx")), c.req.valid("json").ids), 200),
    )
    .openapi(publishRoute, async (c) =>
      c.json(await publishGrades(authedCtx(c.get("ctx")), c.req.valid("json").ids), 200),
    )
    .openapi(myGradesRoute, async (c) => c.json(await getMyGrades(authedCtx(c.get("ctx"))), 200));
}
