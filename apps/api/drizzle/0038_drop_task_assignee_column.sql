ALTER TABLE "task" DROP CONSTRAINT "task_personal_unassigned_check";--> statement-breakpoint
ALTER TABLE "task" DROP CONSTRAINT "task_assignee_membership_id_membership_id_fk";
--> statement-breakpoint
DROP INDEX "task_assignee_membership_id_idx";--> statement-breakpoint
ALTER TABLE "task" DROP COLUMN "assignee_membership_id";