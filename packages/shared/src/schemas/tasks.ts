import { z } from "zod";
import { MEMBERSHIP_ROLES, TASK_STATUSES } from "../enums";

const TaskFields = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire").max(120, "Titre trop long"),
  description: z.string().trim().max(2000, "Description trop longue"),
  status: z.enum(TASK_STATUSES, "Statut invalide"),
  /** Membership of the pole (current school year), or null. */
  assigneeMembershipId: z.uuid("Membre invalide").nullable(),
  dueOn: z.iso.date("Date invalide").nullable(),
});

export const CreateTaskInput = TaskFields.extend({
  description: TaskFields.shape.description.default(""),
  status: TaskFields.shape.status.default("todo"),
  assigneeMembershipId: TaskFields.shape.assigneeMembershipId.default(null),
  dueOn: TaskFields.shape.dueOn.default(null),
}).meta({ id: "CreateTaskInput" });
export type CreateTaskInput = z.input<typeof CreateTaskInput>;
export type CreateTaskData = z.output<typeof CreateTaskInput>;

export const UpdateTaskInput = TaskFields.partial().meta({ id: "UpdateTaskInput" });
export type UpdateTaskData = z.output<typeof UpdateTaskInput>;

const PoleMemberShape = z.object({
  membershipId: z.uuid(),
  role: z.enum(MEMBERSHIP_ROLES),
  user: z.object({ id: z.uuid(), name: z.string(), promo: z.string().nullable() }),
});

export const PoleMemberDto = PoleMemberShape.meta({ id: "PoleMember" });
export type PoleMemberDto = z.infer<typeof PoleMemberDto>;

export const TaskDto = z
  .object({
    id: z.uuid(),
    title: z.string(),
    description: z.string(),
    status: z.enum(TASK_STATUSES),
    dueOn: z.string().nullable(),
    pole: z.object({ id: z.uuid(), name: z.string() }),
    // Inline (not a $ref): a nullable reference is generated as an unusable allOf type.
    assignee: PoleMemberShape.nullable(),
    /** Organisers edit everything; the assignee only moves the status. */
    canEdit: z.boolean(),
    canMove: z.boolean(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "Task" });
export type TaskDto = z.infer<typeof TaskDto>;
