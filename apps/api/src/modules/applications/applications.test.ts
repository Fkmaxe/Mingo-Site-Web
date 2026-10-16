import { ApplicationDto, ApplicationFormDto, MeDto, MyApplicationDto } from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { auditLog } from "../../db/schema";
import { authHeaders } from "../../test/auth";
import { getTestDb } from "../../test/db";
import { createTestApp, testApplicationFiles, testMailer } from "../../test/env";
import { createPersona, createPole, createSchoolYear, createUser } from "../../test/factories";
import { readError, readJson } from "../../test/http";
import { call } from "../../test/request";

type Pole = Awaited<ReturnType<typeof createPole>>;
let sport: Pole;
let com: Pole;
let lead: { id: string };
let board: { id: string };

beforeEach(async () => {
  await createSchoolYear();
  sport = await createPole({ slug: "sport", name: "Sport" });
  com = await createPole({ slug: "communication", name: "Communication" });
  lead = await createPersona("pole_lead", { poleId: sport.id });
  board = await createPersona("board");
});

const motivation = "J'adore organiser des tournois et j'ai du temps cette année.";
const applyAs = (userId: string, wishedPoleId: string) =>
  call("POST", "/v1/applications", userId, {
    wishedPoleIds: [wishedPoleId],
    answers: { motivation },
  });

describe("applying", () => {
  it("lets a student apply once a year and follow the status", async () => {
    const student = await createPersona("student");
    const res = await applyAs(student.id, sport.id);
    expect(res.status).toBe(201);
    expect(await readJson(res, ApplicationDto)).toMatchObject({
      status: "new",
      wishes: [{ name: "Sport" }],
      answers: { motivation },
      missingDocuments: [],
    });
    expect((await readError(await applyAs(student.id, com.id))).code).toBe("ALREADY_APPLIED");
    const mine = await readJson(
      await call("GET", "/v1/me/application", student.id),
      MyApplicationDto,
    );
    expect(mine?.status).toBe("new");
  });

  it("refuses members and a missing motivation", async () => {
    const member = await createPersona("member", { poleId: com.id });
    expect((await readError(await applyAs(member.id, sport.id))).code).toBe("ALREADY_MEMBER");
    const student = await createPersona("student");
    const res = await call("POST", "/v1/applications", student.id, {
      wishedPoleIds: [sport.id],
      answers: {},
    });
    expect(res.status).toBe(400);
    expect((await readError(res)).details).toMatchObject({
      issues: [{ path: ["answers", "motivation"] }],
    });
  });

  it("can be withdrawn while new", async () => {
    const student = await createPersona("student");
    await applyAs(student.id, sport.id);
    expect((await call("DELETE", "/v1/me/application", student.id)).status).toBe(204);
    expect(
      await readJson(await call("GET", "/v1/me/application", student.id), MyApplicationDto),
    ).toBeNull();
  });
});

describe("reviewing", () => {
  it("shows a lead the applications to their pole only", async () => {
    await applyAs((await createPersona("student")).id, sport.id);
    await applyAs((await createPersona("student")).id, com.id);
    const forLead = await readJson(
      await call("GET", "/v1/applications", lead.id),
      z.array(ApplicationDto),
    );
    expect(forLead.map((a) => a.wishes[0]?.name)).toEqual(["Sport"]);
    const forBoard = await readJson(
      await call("GET", "/v1/applications", board.id),
      z.array(ApplicationDto),
    );
    expect(forBoard).toHaveLength(2);
    const member = await createPersona("member", { poleId: sport.id });
    expect((await call("GET", "/v1/applications", member.id)).status).toBe(403);
  });

  it("accepts: membership created, audited, mailed, the student becomes a member", async () => {
    const student = await createUser({ email: "recrue@myskolae.fr" });
    const application = await readJson(await applyAs(student.id, sport.id), ApplicationDto);
    await call("POST", `/v1/applications/${application.id}/decide`, lead.id, {
      status: "interview",
    });
    const res = await call("POST", `/v1/applications/${application.id}/accept`, lead.id, {});
    expect((await readJson(res, ApplicationDto)).status).toBe("accepted");

    const me = await readJson(await call("GET", "/v1/me", student.id), MeDto);
    expect(me.roles).toContain("member");
    expect(me.memberships[0]?.pole?.name).toBe("Sport");
    expect(testMailer.lastTo("recrue@myskolae.fr")?.subject).toBe("Bienvenue au BDE Mingo !");
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "membership.created"));
    expect(audit).toHaveLength(1);
    const again = await call("POST", `/v1/applications/${application.id}/accept`, lead.id, {});
    expect(again.status).toBe(409);
  });

  it("lets the board place someone in another pole, but not a lead", async () => {
    const student = await createPersona("student");
    const application = await readJson(await applyAs(student.id, sport.id), ApplicationDto);
    expect(
      (await call("POST", `/v1/applications/${application.id}/accept`, lead.id, { poleId: com.id }))
        .status,
    ).toBe(403);
    expect(
      (
        await call("POST", `/v1/applications/${application.id}/accept`, board.id, {
          poleId: com.id,
        })
      ).status,
    ).toBe(200);
    const me = await readJson(await call("GET", "/v1/me", student.id), MeDto);
    expect(me.memberships[0]?.pole?.name).toBe("Communication");
  });

  it("rejects with a mail, and a lead cannot decide for another pole", async () => {
    const student = await createUser({ email: "refus@myskolae.fr" });
    const application = await readJson(await applyAs(student.id, com.id), ApplicationDto);
    expect(
      (
        await call("POST", `/v1/applications/${application.id}/decide`, lead.id, {
          status: "rejected",
        })
      ).status,
    ).toBe(403);
    await call("POST", `/v1/applications/${application.id}/decide`, board.id, {
      status: "rejected",
    });
    expect(testMailer.lastTo("refus@myskolae.fr")?.subject).toBe("Ta candidature au BDE Mingo");
  });
});

const formOf = (overrides: Record<string, unknown> = {}) => ({
  isOpen: true,
  closesAt: null,
  intro: "Rejoins-nous !",
  maxWishes: 2,
  allPolesRecruiting: true,
  recruitingPoleIds: [],
  fields: [
    { key: "motivation", label: "Ta motivation", type: "longtext", required: true },
    {
      key: "dispo",
      label: "Disponibilités",
      type: "select",
      required: true,
      options: ["Le midi", "Le soir"],
    },
  ],
  documents: [
    { key: "cv", label: "CV", required: true, pdfOnly: true, allowLink: false },
    { key: "portfolio", label: "Portfolio", required: false, pdfOnly: false, allowLink: true },
  ],
  ...overrides,
});
const saveForm = (userId: string, overrides: Record<string, unknown> = {}) =>
  call("PUT", "/v1/applications/form", userId, formOf(overrides));

describe("application form", () => {
  it("has defaults, and is set by the bureau only, with an audit entry", async () => {
    const student = await createPersona("student");
    const initial = await readJson(
      await call("GET", "/v1/applications/form", student.id),
      ApplicationFormDto,
    );
    expect(initial).toMatchObject({
      isOpen: true,
      acceptingNow: true,
      maxWishes: 1,
      documents: [],
    });
    expect(initial.fields.map((f) => f.key)).toEqual(["motivation"]);
    expect(initial.recruitingPoles).toHaveLength(2);

    expect((await saveForm(lead.id)).status).toBe(403);
    expect((await saveForm(student.id)).status).toBe(403);
    const saved = await readJson(
      await saveForm(board.id, { allPolesRecruiting: false, recruitingPoleIds: [sport.id] }),
      ApplicationFormDto,
    );
    expect(saved).toMatchObject({ intro: "Rejoins-nous !", maxWishes: 2 });
    expect(saved.recruitingPoles.map((p) => p.name)).toEqual(["Sport"]);
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "application_form.updated"));
    expect(audit).toHaveLength(1);
    expect(
      (await saveForm(board.id, { allPolesRecruiting: false, recruitingPoleIds: [] })).status,
    ).toBe(400);
  });

  it("closes applications, by hand or at the deadline", async () => {
    const student = await createPersona("student");
    await saveForm(board.id, { isOpen: false });
    expect((await readError(await applyAs(student.id, sport.id))).code).toBe("APPLICATIONS_CLOSED");
    await saveForm(board.id, { closesAt: "2020-01-01T00:00:00.000Z" });
    const form = await readJson(
      await call("GET", "/v1/applications/form", student.id),
      ApplicationFormDto,
    );
    expect(form.acceptingNow).toBe(false);
    expect((await readError(await applyAs(student.id, sport.id))).code).toBe("APPLICATIONS_CLOSED");
  });

  it("checks the wishes and the answers against the form", async () => {
    await saveForm(board.id, { allPolesRecruiting: false, recruitingPoleIds: [sport.id] });
    const student = await createPersona("student");
    const send = (body: Record<string, unknown>) =>
      call("POST", "/v1/applications", student.id, body);
    const answers = { motivation, dispo: "Le soir" };
    expect((await send({ wishedPoleIds: [com.id], answers })).status).toBe(400);
    expect((await send({ wishedPoleIds: [sport.id], answers: { motivation } })).status).toBe(400);
    const res = await send({ wishedPoleIds: [sport.id], answers });
    expect(res.status).toBe(201);
    const created = await readJson(res, ApplicationDto);
    expect(created.missingDocuments).toEqual(["CV"]);
    expect(created.questions.map((q) => q.key)).toEqual(["motivation", "dispo"]);

    // Later changes to the form keep the questions the candidate answered.
    await saveForm(board.id, { fields: [] });
    const mine = await readJson(
      await call("GET", "/v1/me/application", student.id),
      MyApplicationDto,
    );
    expect(mine?.questions.map((q) => q.key)).toEqual(["motivation", "dispo"]);
  });

  it("ranks several wishes, seen by the lead of any of them", async () => {
    await saveForm(board.id);
    const comLead = await createPersona("pole_lead", { poleId: com.id });
    const student = await createPersona("student");
    const created = await readJson(
      await call("POST", "/v1/applications", student.id, {
        wishedPoleIds: [com.id, sport.id],
        answers: { motivation, dispo: "Le midi" },
      }),
      ApplicationDto,
    );
    expect(created.wishes.map((w) => w.name)).toEqual(["Communication", "Sport"]);
    const seen = await readJson(
      await call("GET", "/v1/applications", lead.id),
      z.array(ApplicationDto),
    );
    expect(seen.map((a) => a.id)).toEqual([created.id]);
    // Accepted by default in the first wish, by its lead.
    const res = await call("POST", `/v1/applications/${created.id}/accept`, comLead.id, {});
    expect(res.status).toBe(200);
    const me = await readJson(await call("GET", "/v1/me", student.id), MeDto);
    expect(me.memberships[0]?.pole?.name).toBe("Communication");
    expect(
      (
        await call("POST", "/v1/applications", (await createPersona("student")).id, {
          wishedPoleIds: [com.id, sport.id, com.id],
          answers: { motivation, dispo: "Le midi" },
        })
      ).status,
    ).toBe(400);
  });
});

describe("application documents", () => {
  const PDF = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n");
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  async function upload(userId: string, key: string, bytes: Uint8Array, type: string) {
    const headers = await authHeaders(userId);
    headers.set("content-type", type);
    return createTestApp().request(`/v1/me/application/documents/${key}?name=${key}.pdf`, {
      method: "POST",
      headers,
      body: bytes,
    });
  }
  const fileOf = async (url: string, userId: string) =>
    createTestApp().request(`/v1${url}`, { headers: await authHeaders(userId) });

  it("are handed in as files or links, read by the reviewers and the candidate", async () => {
    await saveForm(board.id);
    const student = await createPersona("student");
    await call("POST", "/v1/applications", student.id, {
      wishedPoleIds: [sport.id],
      answers: { motivation, dispo: "Le midi" },
    });
    expect((await upload(student.id, "cv", PNG, "image/png")).status).toBe(400);
    const withCv = await readJson(
      await upload(student.id, "cv", PDF, "application/pdf"),
      ApplicationDto,
    );
    expect(withCv.missingDocuments).toEqual([]);
    expect(
      (
        await call("PUT", "/v1/me/application/documents/cv/link", student.id, {
          url: "https://x.fr",
        })
      ).status,
    ).toBe(400);
    const withLink = await readJson(
      await call("PUT", "/v1/me/application/documents/portfolio/link", student.id, {
        url: "https://drive.google.com/mon-portfolio",
      }),
      ApplicationDto,
    );
    expect(withLink.documents.map((d) => [d.key, d.kind])).toEqual([
      ["cv", "file"],
      ["portfolio", "link"],
    ]);
    expect(
      (
        await call("PUT", "/v1/me/application/documents/portfolio/link", student.id, {
          url: "javascript:alert(1)",
        })
      ).status,
    ).toBe(400);

    const cv = withLink.documents.find((d) => d.key === "cv");
    expect((await fileOf(cv?.url ?? "", lead.id)).status).toBe(200);
    expect((await fileOf(cv?.url ?? "", student.id)).status).toBe(200);
    const comLead = await createPersona("pole_lead", { poleId: com.id });
    expect((await fileOf(cv?.url ?? "", comLead.id)).status).toBe(404);

    // Replacing a file removes the old one from the store; withdrawing removes them all.
    const before = testApplicationFiles.files.size;
    await upload(student.id, "cv", PDF, "application/pdf");
    expect(testApplicationFiles.files.size).toBe(before);
    expect((await call("DELETE", "/v1/me/application", student.id)).status).toBe(204);
    expect(testApplicationFiles.files.size).toBe(before - 1);
  });

  it("are refused for a document not asked, or once the application is decided", async () => {
    await saveForm(board.id);
    const student = await createPersona("student");
    const created = await readJson(
      await call("POST", "/v1/applications", student.id, {
        wishedPoleIds: [sport.id],
        answers: { motivation, dispo: "Le midi" },
      }),
      ApplicationDto,
    );
    expect((await upload(student.id, "lettre", PDF, "application/pdf")).status).toBe(404);
    await call("POST", `/v1/applications/${created.id}/decide`, board.id, { status: "rejected" });
    expect((await readError(await upload(student.id, "cv", PDF, "application/pdf"))).code).toBe(
      "INVALID_STATUS_TRANSITION",
    );
  });
});
