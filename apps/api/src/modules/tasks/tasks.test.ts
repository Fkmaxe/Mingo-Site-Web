import { PoleMemberDto, TaskDetailDto, TaskDto } from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { auditLog } from "../../db/schema";
import { authHeaders } from "../../test/auth";
import { getTestDb } from "../../test/db";
import { createTestApp, testTaskFiles } from "../../test/env";
import { createPersona, createPole, createSchoolYear } from "../../test/factories";
import { readError, readJson } from "../../test/http";
import { call } from "../../test/request";

type Pole = Awaited<ReturnType<typeof createPole>>;
let sport: Pole;
let com: Pole;
let lead: { id: string };
let member: { id: string };

beforeEach(async () => {
  await createSchoolYear();
  sport = await createPole({ slug: "sport", name: "Sport" });
  com = await createPole({ slug: "communication", name: "Communication" });
  lead = await createPersona("pole_lead", { poleId: sport.id });
  member = await createPersona("member", { poleId: sport.id });
});

const members = async (poleId: string, userId: string) =>
  readJson(await call("GET", `/v1/poles/${poleId}/members`, userId), z.array(PoleMemberDto));
const tasks = async (poleId: string, userId: string) =>
  readJson(await call("GET", `/v1/poles/${poleId}/tasks`, userId), z.array(TaskDto));

async function memberMembershipId() {
  const list = await members(sport.id, lead.id);
  const found = list.find((m) => m.user.id === member.id);
  if (!found) throw new Error("membre introuvable");
  return found.membershipId;
}

describe("pole members", () => {
  it("lists members and leads of the pole for BDE members only", async () => {
    const list = await members(sport.id, member.id);
    expect(list.map((m) => [m.user.id, m.role]).sort()).toEqual(
      [
        [lead.id, "pole_lead"],
        [member.id, "member"],
      ].sort(),
    );
    const student = await createPersona("student");
    expect((await call("GET", `/v1/poles/${sport.id}/members`, student.id)).status).toBe(403);
  });
});

describe("tasks", () => {
  it("are created and assigned by the pole lead, visible to the pole", async () => {
    const res = await call("POST", `/v1/poles/${sport.id}/tasks`, lead.id, {
      title: "Réserver le gymnase",
      dueOn: "2026-11-15",
      assigneeMembershipIds: [await memberMembershipId()],
    });
    expect(res.status).toBe(201);
    expect(await readJson(res, TaskDetailDto)).toMatchObject({
      title: "Réserver le gymnase",
      status: "todo",
      priority: "normal",
      dueOn: "2026-11-15",
      assignees: [{ user: { id: member.id } }],
      canEdit: true,
    });

    const seen = await tasks(sport.id, member.id);
    expect(seen.map((t) => [t.title, t.canEdit, t.canContribute])).toEqual([
      ["Réserver le gymnase", false, true],
    ]);
    const mine = await readJson(await call("GET", "/v1/me/tasks", member.id), z.array(TaskDto));
    expect(mine).toHaveLength(1);
  });

  it("refuses assignees outside the pole and other poles' members", async () => {
    const outsider = await createPersona("member", { poleId: com.id });
    const outsiderMembership = (await members(com.id, outsider.id))[0]?.membershipId;
    const res = await call("POST", `/v1/poles/${sport.id}/tasks`, lead.id, {
      title: "X",
      assigneeMembershipIds: [outsiderMembership],
    });
    expect(res.status).toBe(400);
    expect((await call("GET", `/v1/poles/${sport.id}/tasks`, outsider.id)).status).toBe(403);
    expect(
      (await call("POST", `/v1/poles/${sport.id}/tasks`, member.id, { title: "X" })).status,
    ).toBe(403);
  });

  it("lets the assignee move the status only", async () => {
    const created = await readJson(
      await call("POST", `/v1/poles/${sport.id}/tasks`, lead.id, {
        title: "Affiche",
        assigneeMembershipIds: [await memberMembershipId()],
      }),
      TaskDetailDto,
    );
    const moved = await call("PATCH", `/v1/tasks/${created.id}`, member.id, { status: "doing" });
    expect((await readJson(moved, TaskDetailDto)).status).toBe("doing");
    const reassigned = await call("PATCH", `/v1/tasks/${created.id}`, member.id, {
      assigneeMembershipIds: [],
    });
    expect(reassigned.status).toBe(403);
    const renamed = await call("PATCH", `/v1/tasks/${created.id}`, member.id, { title: "Hack" });
    expect(renamed.status).toBe(403);

    const other = await createPersona("member", { poleId: sport.id });
    expect(
      (await call("PATCH", `/v1/tasks/${created.id}`, other.id, { status: "done" })).status,
    ).toBe(403);
  });

  it("orders open tasks first and soft-deletes with an audit entry", async () => {
    for (const [title, status] of [
      ["Fini", "done"],
      ["A faire", "todo"],
      ["En cours", "doing"],
    ] as const) {
      await call("POST", `/v1/poles/${sport.id}/tasks`, lead.id, { title, status });
    }
    const list = await tasks(sport.id, lead.id);
    expect(list.map((t) => t.title)).toEqual(["En cours", "A faire", "Fini"]);

    const target = list[0];
    expect((await call("DELETE", `/v1/tasks/${target?.id}`, member.id)).status).toBe(403);
    expect((await call("DELETE", `/v1/tasks/${target?.id}`, lead.id)).status).toBe(204);
    expect((await tasks(sport.id, lead.id)).map((t) => t.title)).toEqual(["A faire", "Fini"]);
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "task.deleted"));
    expect(audit).toHaveLength(1);
    const gone = await call("PATCH", `/v1/tasks/${target?.id}`, lead.id, { status: "done" });
    expect((await readError(gone)).code).toBe("NOT_FOUND");
  });

  it("lets the board manage every pole", async () => {
    const board = await createPersona("board");
    expect(
      (await call("POST", `/v1/poles/${com.id}/tasks`, board.id, { title: "Flyers" })).status,
    ).toBe(201);
    expect(await tasks(com.id, board.id)).toHaveLength(1);
  });
});

describe("bureau tasks", () => {
  const boardTasks = async (userId: string) =>
    readJson(await call("GET", "/v1/board/tasks", userId), z.array(TaskDto));

  it("are created and assigned within the bureau, seen by the bureau only", async () => {
    const president = await createPersona("board");
    const treasurer = await createPersona("board");
    const seats = await readJson(
      await call("GET", "/v1/board/members", president.id),
      z.array(PoleMemberDto),
    );
    const seat = seats.find((m) => m.user.id === treasurer.id);
    expect(seats.map((m) => m.user.id).sort()).toEqual([president.id, treasurer.id].sort());

    const res = await call("POST", "/v1/board/tasks", president.id, {
      title: "Bilan financier",
      assigneeMembershipIds: [seat?.membershipId],
    });
    expect(res.status).toBe(201);
    expect(await readJson(res, TaskDetailDto)).toMatchObject({
      scope: "board",
      pole: null,
      assignees: [{ user: { id: treasurer.id } }],
      canEdit: true,
    });
    expect((await boardTasks(treasurer.id)).map((t) => t.title)).toEqual(["Bilan financier"]);
    const mine = await readJson(await call("GET", "/v1/me/tasks", treasurer.id), z.array(TaskDto));
    expect(mine.map((t) => t.scope)).toEqual(["board"]);

    for (const outsider of [lead, member]) {
      expect((await call("GET", "/v1/board/tasks", outsider.id)).status).toBe(403);
      expect((await call("POST", "/v1/board/tasks", outsider.id, { title: "X" })).status).toBe(403);
      expect((await call("GET", "/v1/board/members", outsider.id)).status).toBe(403);
    }
    expect((await call("GET", "/v1/board/tasks", null)).status).toBe(401);
  });

  it("are hidden from anyone outside the bureau, who cannot move or delete them", async () => {
    const board = await createPersona("board");
    const created = await readJson(
      await call("POST", "/v1/board/tasks", board.id, { title: "Budget annuel" }),
      TaskDetailDto,
    );
    for (const outsider of [lead, member]) {
      const moved = await call("PATCH", `/v1/tasks/${created.id}`, outsider.id, { status: "done" });
      expect(moved.status).toBe(404);
      expect((await call("DELETE", `/v1/tasks/${created.id}`, outsider.id)).status).toBe(404);
      const theirs = await readJson(
        await call("GET", "/v1/me/tasks", outsider.id),
        z.array(TaskDto),
      );
      expect(theirs).toHaveLength(0);
    }
    const kept = await readJson(await call("GET", "/v1/board/tasks", board.id), z.array(TaskDto));
    expect(kept.map((t) => [t.title, t.status])).toEqual([["Budget annuel", "todo"]]);
  });

  it("refuses an assignee outside the bureau", async () => {
    const board = await createPersona("board");
    const res = await call("POST", "/v1/board/tasks", board.id, {
      title: "X",
      assigneeMembershipIds: [await memberMembershipId()],
    });
    expect(res.status).toBe(400);
    expect((await readError(res)).message).toBe("Une de ces personnes n'est pas au bureau.");
  });
});

describe("personal tasks", () => {
  const createPersonal = (userId: string, body: Record<string, unknown>) =>
    call("POST", "/v1/me/tasks", userId, body);

  it("are created by a member and listed with their assigned tasks", async () => {
    const res = await createPersonal(member.id, {
      title: "Réviser le partiel",
      dueOn: "2026-12-01",
    });
    expect(res.status).toBe(201);
    const created = await readJson(res, TaskDetailDto);
    expect(created).toMatchObject({
      scope: "personal",
      pole: null,
      assignees: [],
      canEdit: true,
      canContribute: true,
    });

    const moved = await call("PATCH", `/v1/tasks/${created.id}`, member.id, {
      status: "doing",
      title: "Réviser le partiel de maths",
    });
    expect(await readJson(moved, TaskDetailDto)).toMatchObject({
      status: "doing",
      title: "Réviser le partiel de maths",
    });
    const mine = await readJson(await call("GET", "/v1/me/tasks", member.id), z.array(TaskDto));
    expect(mine.map((t) => t.id)).toEqual([created.id]);
    expect((await call("DELETE", `/v1/tasks/${created.id}`, member.id)).status).toBe(204);
  });

  it("stay private, the bureau included", async () => {
    const created = await readJson(
      await createPersonal(member.id, { title: "Perso" }),
      TaskDetailDto,
    );
    const board = await createPersona("board");
    for (const other of [lead, board]) {
      expect(
        (await call("PATCH", `/v1/tasks/${created.id}`, other.id, { status: "done" })).status,
      ).toBe(404);
      expect((await call("DELETE", `/v1/tasks/${created.id}`, other.id)).status).toBe(404);
      const theirs = await readJson(await call("GET", "/v1/me/tasks", other.id), z.array(TaskDto));
      expect(theirs).toHaveLength(0);
    }
    expect(await tasks(sport.id, lead.id)).toHaveLength(0);
    expect(
      await readJson(await call("GET", "/v1/board/tasks", board.id), z.array(TaskDto)),
    ).toHaveLength(0);
  });

  it("are not assigned to anyone, and are for BDE members only", async () => {
    const created = await readJson(
      await createPersonal(member.id, { title: "Perso" }),
      TaskDetailDto,
    );
    const assigned = await call("PATCH", `/v1/tasks/${created.id}`, member.id, {
      assigneeMembershipIds: [await memberMembershipId()],
    });
    expect(assigned.status).toBe(400);

    const student = await createPersona("student");
    expect((await createPersonal(student.id, { title: "X" })).status).toBe(403);
    expect((await createPersonal(member.id, { title: "" })).status).toBe(400);
    expect((await call("POST", "/v1/me/tasks", null, { title: "X" })).status).toBe(401);
  });
});

const createIn = async (poleId: string, userId: string, body: Record<string, unknown> = {}) =>
  readJson(
    await call("POST", `/v1/poles/${poleId}/tasks`, userId, { title: "Tâche", ...body }),
    TaskDetailDto,
  );
const detail = async (taskId: string, userId: string) =>
  readJson(await call("GET", `/v1/tasks/${taskId}`, userId), TaskDetailDto);

describe("Gestion → Tâches", () => {
  const managed = async (userId: string, query = "") =>
    readJson(await call("GET", `/v1/tasks${query}`, userId), z.array(TaskDto));

  it("shows the bureau every board, and pole leads every pole without editing the others", async () => {
    const board = await createPersona("board");
    const comLead = await createPersona("pole_lead", { poleId: com.id });
    await call("POST", "/v1/board/tasks", board.id, { title: "Bureau" });
    await createIn(sport.id, lead.id, { title: "Sport" });
    const comTask = await createIn(com.id, comLead.id, { title: "Com" });

    expect((await managed(board.id)).map((t) => t.title).sort()).toEqual([
      "Bureau",
      "Com",
      "Sport",
    ]);
    const seenByLead = await managed(lead.id);
    expect(seenByLead.map((t) => [t.title, t.canEdit]).sort()).toEqual([
      ["Com", false],
      ["Sport", true],
    ]);
    expect((await detail(comTask.id, lead.id)).canEdit).toBe(false);
    const edit = await call("PATCH", `/v1/tasks/${comTask.id}`, lead.id, { title: "Hack" });
    expect(edit.status).toBe(403);
    expect((await call("GET", "/v1/tasks?board=board", lead.id)).status).toBe(403);
    expect((await call("GET", "/v1/tasks", member.id)).status).toBe(403);
  });

  it("filters by board, status, assignee, deadline and text", async () => {
    const membershipId = await memberMembershipId();
    await createIn(sport.id, lead.id, {
      title: "Réserver le gymnase",
      dueOn: "2000-01-01",
      assigneeMembershipIds: [membershipId],
    });
    await createIn(sport.id, lead.id, { title: "Affiches", status: "doing" });
    const comLead = await createPersona("pole_lead", { poleId: com.id });
    await createIn(com.id, comLead.id, { title: "Post Instagram" });

    const titles = async (query: string) => (await managed(lead.id, query)).map((t) => t.title);
    expect(await titles(`?board=${com.id}`)).toEqual(["Post Instagram"]);
    expect(await titles("?status=doing")).toEqual(["Affiches"]);
    expect(await titles(`?assigneeUserId=${member.id}`)).toEqual(["Réserver le gymnase"]);
    expect(await titles("?late=true")).toEqual(["Réserver le gymnase"]);
    expect(await titles("?q=gymnase")).toEqual(["Réserver le gymnase"]);
  });
});

describe("task detail", () => {
  it("has several assignees, a priority, and a history", async () => {
    const second = await createPersona("member", { poleId: sport.id });
    const ids = await members(sport.id, lead.id);
    const of = (userId: string) => ids.find((m) => m.user.id === userId)?.membershipId;
    const created = await createIn(sport.id, lead.id, {
      priority: "high",
      assigneeMembershipIds: [of(member.id), of(second.id)],
    });
    expect(created.assignees.map((a) => a.user.id).sort()).toEqual([member.id, second.id].sort());
    expect((await detail(created.id, second.id)).canContribute).toBe(true);

    const res = await call("PATCH", `/v1/tasks/${created.id}`, lead.id, {
      dueOn: "2026-12-01",
      assigneeMembershipIds: [of(second.id)],
    });
    const updated = await readJson(res, TaskDetailDto);
    expect(updated.assignees.map((a) => a.user.id)).toEqual([second.id]);
    expect(updated.history.map((h) => h.action)).toEqual(["task.updated", "task.created"]);
    expect(updated.history[0]?.detail).toContain("délai");
    expect((await detail(created.id, member.id)).canContribute).toBe(false);
  });

  it("has a checklist ticked by assignees, edited by organisers", async () => {
    const created = await createIn(sport.id, lead.id, {
      assigneeMembershipIds: [await memberMembershipId()],
    });
    const added = await readJson(
      await call("POST", `/v1/tasks/${created.id}/checklist`, lead.id, { label: "Appeler" }),
      TaskDetailDto,
    );
    const step = added.checklistItems[0];
    expect(step).toMatchObject({ label: "Appeler", done: false });
    expect(
      (await call("POST", `/v1/tasks/${created.id}/checklist`, member.id, { label: "X" })).status,
    ).toBe(403);
    const ticked = await readJson(
      await call("PATCH", `/v1/tasks/checklist/${step?.id}`, member.id, { done: true }),
      TaskDetailDto,
    );
    expect(ticked.checklist).toEqual({ done: 1, total: 1 });
    expect(
      (await call("PATCH", `/v1/tasks/checklist/${step?.id}`, member.id, { label: "Hack" })).status,
    ).toBe(403);
    expect((await call("DELETE", `/v1/tasks/checklist/${step?.id}`, member.id)).status).toBe(403);
    const removed = await readJson(
      await call("DELETE", `/v1/tasks/checklist/${step?.id}`, lead.id),
      TaskDetailDto,
    );
    expect(removed.checklistItems).toEqual([]);
  });

  it("has comments from organisers and assignees", async () => {
    const created = await createIn(sport.id, lead.id, {
      assigneeMembershipIds: [await memberMembershipId()],
    });
    const other = await createPersona("member", { poleId: sport.id });
    const res = await call("POST", `/v1/tasks/${created.id}/comments`, member.id, {
      body: "C'est réservé",
    });
    expect(res.status).toBe(201);
    const comment = (await readJson(res, TaskDetailDto)).comments[0];
    expect(comment).toMatchObject({ body: "C'est réservé", author: { id: member.id } });
    expect(
      (await call("POST", `/v1/tasks/${created.id}/comments`, other.id, { body: "x" })).status,
    ).toBe(403);
    expect((await call("DELETE", `/v1/tasks/comments/${comment?.id}`, other.id)).status).toBe(403);
    const after = await readJson(
      await call("DELETE", `/v1/tasks/comments/${comment?.id}`, lead.id),
      TaskDetailDto,
    );
    expect([after.comments, after.commentCount]).toEqual([[], 0]);
  });
});

describe("task files", () => {
  const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n");
  const DOCX = new Uint8Array([
    0x50,
    0x4b,
    0x03,
    0x04,
    ...new TextEncoder().encode("[Content_Types].xml word/document.xml"),
  ]);
  const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  async function upload(
    taskId: string,
    userId: string,
    bytes: Uint8Array,
    type: string,
    name: string,
  ) {
    const headers = await authHeaders(userId);
    headers.set("content-type", type);
    return createTestApp().request(
      `/v1/tasks/${taskId}/attachments?name=${encodeURIComponent(name)}`,
      { method: "POST", headers, body: bytes },
    );
  }
  const fileOf = async (url: string, userId: string) =>
    createTestApp().request(`/v1${url}`, { headers: await authHeaders(userId) });

  it("accept photos, PDF and documents, served to who sees the task", async () => {
    const created = await createIn(sport.id, lead.id, {
      assigneeMembershipIds: [await memberMembershipId()],
    });
    const withPdf = await readJson(
      await upload(created.id, member.id, PDF, "application/pdf", "devis.pdf"),
      TaskDetailDto,
    );
    const withDoc = await readJson(
      await upload(created.id, lead.id, DOCX, DOCX_TYPE, "planning.docx"),
      TaskDetailDto,
    );
    expect(withDoc.attachments.map((a) => [a.name, a.contentType])).toEqual([
      ["devis.pdf", "application/pdf"],
      ["planning.docx", DOCX_TYPE],
    ]);
    expect(withDoc.attachmentCount).toBe(2);

    const doc = withDoc.attachments[1];
    const served = await fileOf(doc?.url ?? "", member.id);
    expect(served.status).toBe(200);
    expect(served.headers.get("content-disposition")).toBe(
      "attachment; filename*=UTF-8''planning.docx",
    );
    const pdf = await fileOf(withPdf.attachments[0]?.url ?? "", member.id);
    expect(pdf.headers.get("content-disposition")).toBe("inline");
    const student = await createPersona("student");
    expect((await fileOf(doc?.url ?? "", student.id)).status).toBe(404);

    // The assignee removes their own file only.
    const pdfId = withPdf.attachments[0]?.id;
    expect((await call("DELETE", `/v1/tasks/attachments/${doc?.id}`, member.id)).status).toBe(403);
    expect((await call("DELETE", `/v1/tasks/attachments/${pdfId}`, member.id)).status).toBe(200);
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "task.attachment_removed"));
    expect(audit).toHaveLength(1);
  });

  it("refuse a file whose bytes do not match its type, and other people", async () => {
    const created = await createIn(sport.id, lead.id);
    const before = testTaskFiles.files.size;
    const fake = await upload(created.id, lead.id, PDF.slice(1), DOCX_TYPE, "faux.docx");
    expect(fake.status).toBe(400);
    const html = await upload(created.id, lead.id, PDF.slice(1), "text/html", "x.html");
    expect(html.status).toBe(400);
    const other = await createPersona("member", { poleId: sport.id });
    expect((await upload(created.id, other.id, PDF, "application/pdf", "a.pdf")).status).toBe(403);
    expect(testTaskFiles.files.size).toBe(before);
  });
});
