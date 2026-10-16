import { z } from "zod";
import { MEMBERSHIP_ROLES, TASK_PRIORITIES, TASK_SCOPES, TASK_STATUSES } from "../enums";
import { DOCUMENT_FILE_TYPES } from "./documents";

export const TASK_FILES_PER_TASK = 10;
export const TASK_ASSIGNEES_MAX = 20;
export const TASK_CHECKLIST_MAX = 50;

const TaskFields = z.object({
  title: z.string().trim().min(1, "Le titre est obligatoire").max(120, "Titre trop long"),
  description: z.string().trim().max(5000, "Description trop longue"),
  status: z.enum(TASK_STATUSES, "Statut invalide"),
  priority: z.enum(TASK_PRIORITIES, "Priorité invalide"),
  /** Memberships of the pole (or of the bureau for a bureau task), current school year. */
  assigneeMembershipIds: z
    .array(z.uuid("Membre invalide"))
    .max(TASK_ASSIGNEES_MAX, `${TASK_ASSIGNEES_MAX} personnes au plus`),
  dueOn: z.iso.date("Date invalide").nullable(),
});

export const CreateTaskInput = TaskFields.extend({
  description: TaskFields.shape.description.default(""),
  status: TaskFields.shape.status.default("todo"),
  priority: TaskFields.shape.priority.default("normal"),
  assigneeMembershipIds: TaskFields.shape.assigneeMembershipIds.default([]),
  dueOn: TaskFields.shape.dueOn.default(null),
}).meta({ id: "CreateTaskInput" });
export type CreateTaskInput = z.input<typeof CreateTaskInput>;
export type CreateTaskData = z.output<typeof CreateTaskInput>;

/** A personal task: nobody else is assigned, only its author sees it. */
export const CreatePersonalTaskInput = CreateTaskInput.omit({ assigneeMembershipIds: true }).meta({
  id: "CreatePersonalTaskInput",
});
export type CreatePersonalTaskInput = z.input<typeof CreatePersonalTaskInput>;
export type CreatePersonalTaskData = z.output<typeof CreatePersonalTaskInput>;

/** `assigneeMembershipIds` replaces the whole list. */
export const UpdateTaskInput = TaskFields.partial().meta({ id: "UpdateTaskInput" });
export type UpdateTaskData = z.output<typeof UpdateTaskInput>;

/** Gestion → Tâches: every board the user can see, filtered. */
export const ListTasksQuery = z.object({
  /** A pole id, or "board" for the bureau board. */
  board: z.union([z.literal("board"), z.uuid()]).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  /** Tasks assigned to that user. */
  assigneeUserId: z.uuid().optional(),
  /** Open tasks past their deadline. */
  late: z.enum(["true", "false"]).optional(),
  q: z.string().trim().max(100).optional(),
});
export type ListTasksQuery = z.infer<typeof ListTasksQuery>;

export const ChecklistItemInput = z
  .object({ label: z.string().trim().min(1, "Écris l'étape").max(200, "Étape trop longue") })
  .meta({ id: "ChecklistItemInput" });

export const UpdateChecklistItemInput = z
  .object({ label: ChecklistItemInput.shape.label, done: z.boolean() })
  .partial()
  .meta({ id: "UpdateChecklistItemInput" });
export type UpdateChecklistItemData = z.output<typeof UpdateChecklistItemInput>;

export const TaskCommentInput = z
  .object({
    body: z.string().trim().min(1, "Écris un message").max(2000, "Message trop long"),
  })
  .meta({ id: "TaskCommentInput" });

export const TaskFileUploadQuery = z.object({
  /** Original file name, shown in the task. */
  name: z.string().trim().min(1).max(200),
});

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
    priority: z.enum(TASK_PRIORITIES),
    dueOn: z.string().nullable(),
    /** Pole board, bureau board, or personal task. */
    scope: z.enum(TASK_SCOPES),
    /** The pole of a pole task; null for the bureau and personal tasks. */
    pole: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    assignees: z.array(PoleMemberDto),
    checklist: z.object({ done: z.int(), total: z.int() }),
    attachmentCount: z.int(),
    commentCount: z.int(),
    /** Organisers (or the author of a personal task) edit everything. */
    canEdit: z.boolean(),
    /** Organisers and assignees move the status, tick the checklist, comment and join files. */
    canContribute: z.boolean(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "Task" });
export type TaskDto = z.infer<typeof TaskDto>;

const Person = z.object({ id: z.uuid(), name: z.string() });

export const ChecklistItemDto = z
  .object({ id: z.uuid(), label: z.string(), done: z.boolean() })
  .meta({ id: "ChecklistItem" });

export const TaskCommentDto = z
  .object({
    id: z.uuid(),
    body: z.string(),
    // Inline (not a $ref): a nullable reference is generated as an unusable allOf type.
    author: Person.nullable(),
    createdAt: z.iso.datetime(),
    canDelete: z.boolean(),
  })
  .meta({ id: "TaskComment" });

export const TaskAttachmentDto = z
  .object({
    id: z.uuid(),
    name: z.string(),
    contentType: z.enum(DOCUMENT_FILE_TYPES),
    sizeBytes: z.int(),
    /** Path on the web origin (the web relays the file). */
    url: z.string(),
    uploadedBy: Person.nullable(),
    createdAt: z.iso.datetime(),
    canDelete: z.boolean(),
  })
  .meta({ id: "TaskAttachment" });

/** One line of the task's history, read from the audit log. */
export const TaskEventDto = z
  .object({
    id: z.uuid(),
    /** `task.created`, `task.updated`, `task.attachment_added`… */
    action: z.string(),
    actor: Person.nullable(),
    /** Changed fields for `task.updated`, file or step name otherwise. */
    detail: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "TaskEvent" });

export const TaskDetailDto = TaskDto.extend({
  checklistItems: z.array(ChecklistItemDto),
  comments: z.array(TaskCommentDto),
  attachments: z.array(TaskAttachmentDto),
  history: z.array(TaskEventDto),
}).meta({ id: "TaskDetail" });
export type TaskDetailDto = z.infer<typeof TaskDetailDto>;
