import { ApplicationDto, MeDto, MyApplicationDto } from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { auditLog } from "../../db/schema";
import { getTestDb } from "../../test/db";
import { testMailer } from "../../test/env";
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
  call("POST", "/v1/applications", userId, { wishedPoleId, motivation });

describe("applying", () => {
  it("lets a student apply once a year and follow the status", async () => {
    const student = await createPersona("student");
    const res = await applyAs(student.id, sport.id);
    expect(res.status).toBe(201);
    expect(await readJson(res, ApplicationDto)).toMatchObject({
      status: "new",
      wishedPole: { name: "Sport" },
    });
    expect((await readError(await applyAs(student.id, com.id))).code).toBe("ALREADY_APPLIED");
    const mine = await readJson(
      await call("GET", "/v1/me/application", student.id),
      MyApplicationDto,
    );
    expect(mine?.status).toBe("new");
  });

  it("refuses members and short motivations", async () => {
    const member = await createPersona("member", { poleId: com.id });
    expect((await readError(await applyAs(member.id, sport.id))).code).toBe("ALREADY_MEMBER");
    const student = await createPersona("student");
    const res = await call("POST", "/v1/applications", student.id, {
      wishedPoleId: sport.id,
      motivation: "Moi",
    });
    expect(res.status).toBe(400);
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
    expect(forLead.map((a) => a.wishedPole.name)).toEqual(["Sport"]);
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
