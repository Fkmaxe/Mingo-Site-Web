CREATE TYPE "public"."task_scope" AS ENUM('pole', 'board', 'personal');--> statement-breakpoint
ALTER TABLE "task" ALTER COLUMN "pole_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "scope" "task_scope" DEFAULT 'pole' NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "task_owner_user_id_idx" ON "task" USING btree ("owner_user_id");--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_pole_scope_check" CHECK (("task"."scope" = 'pole') = ("task"."pole_id" is not null));--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_personal_scope_check" CHECK (("task"."scope" = 'personal') = ("task"."owner_user_id" is not null));--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_personal_unassigned_check" CHECK ("task"."scope" <> 'personal' or "task"."assignee_membership_id" is null);