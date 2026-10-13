import { ClassesDto, MeDto } from "@bde/shared";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { auditLog, user } from "../../db/schema";
import { authHeaders } from "../../test/auth";
import { getTestDb } from "../../test/db";
import { createTestApp, testPhotos } from "../../test/env";
import { createUser } from "../../test/factories";
import { readError, readJson } from "../../test/http";
import { call } from "../../test/request";

type User = Awaited<ReturnType<typeof createUser>>;
let admin: User;
let student: User;

beforeEach(async () => {
  admin = await createUser({ isAdmin: true });
  student = await createUser();
});

async function level(name: string, position?: number) {
  const res = await call("POST", "/v1/admin/levels", admin.id, {
    name,
    ...(position === undefined ? {} : { position }),
  });
  const dto = await readJson(res, ClassesDto);
  const found = dto.levels.find((l) => l.name === name);
  if (!found) throw new Error("level");
  return found.id;
}

async function track(name: string) {
  const dto = await readJson(
    await call("POST", "/v1/admin/tracks", admin.id, { name }),
    ClassesDto,
  );
  const found = dto.tracks.find((t) => t.name === name);
  if (!found) throw new Error("track");
  return found.id;
}

describe("levels and tracks", () => {
  it("are managed by administrators, listed in order for everyone signed in", async () => {
    await level("3A");
    await level("1A", 5);
    await track("Dev");
    expect((await call("POST", "/v1/admin/levels", student.id, { name: "4A" })).status).toBe(403);
    expect((await call("GET", "/v1/classes", null)).status).toBe(401);
    const dto = await readJson(await call("GET", "/v1/classes", student.id), ClassesDto);
    expect(dto.levels.map((l) => l.name)).toEqual(["1A", "3A"]);
    expect(dto.tracks.map((t) => t.name)).toEqual(["Dev"]);
  });

  it("refuses a name used twice, whatever the case", async () => {
    await track("Cyber");
    const res = await call("POST", "/v1/admin/tracks", admin.id, { name: "cyber" });
    expect((await readError(res)).code).toBe("ALREADY_EXISTS");
  });
});

describe("a student's class", () => {
  it("is chosen by the student, shown as « 3A · Dev », renamed with its level", async () => {
    const third = await level("3A");
    const dev = await track("Dev");
    const me = await readJson(
      await call("PUT", "/v1/me/class", student.id, { levelId: third, trackId: dev }),
      MeDto,
    );
    expect(me).toMatchObject({ promo: "3A · Dev", level: { name: "3A" }, track: { name: "Dev" } });

    await call("PUT", `/v1/admin/levels/${third}`, admin.id, { name: "B3" });
    const [row] = await getTestDb().select().from(user).where(eq(user.id, student.id));
    expect(row?.promo).toBe("B3 · Dev");

    const counts = await readJson(await call("GET", "/v1/classes", student.id), ClassesDto);
    expect(counts.levels.find((l) => l.id === third)?.userCount).toBe(1);

    const cleared = await readJson(
      await call("PUT", "/v1/me/class", student.id, { levelId: null, trackId: dev }),
      MeDto,
    );
    expect(cleared.promo).toBe("Dev");
  });

  it("refuses an unknown level", async () => {
    const res = await call("PUT", "/v1/me/class", student.id, {
      levelId: "00000000-0000-4000-8000-000000000000",
      trackId: null,
    });
    expect(res.status).toBe(404);
  });
});

describe("ESGI rules: programmes per year, work-study", () => {
  async function levelWith(name: string, alternanceOnly: boolean, trackIds: string[]) {
    const res = await call("POST", "/v1/admin/levels", admin.id, {
      name,
      alternanceOnly,
      trackIds,
    });
    const dto = await readJson(res, ClassesDto);
    const found = dto.levels.find((l) => l.name === name);
    if (!found) throw new Error("level");
    return found;
  }

  it("offers only the year's programmes and lets 1A students choose their rhythm", async () => {
    const tronc = await track("Tronc commun");
    const mcsi = await track("MCSI");
    const secu = await track("Sécurité");
    const first = await levelWith("1A", false, [tronc, mcsi]);
    expect(first).toMatchObject({ alternanceOnly: false });
    expect([...first.trackIds].sort()).toEqual([tronc, mcsi].sort());

    const me = await readJson(
      await call("PUT", "/v1/me/class", student.id, {
        levelId: first.id,
        trackId: mcsi,
        rhythm: "alternance",
      }),
      MeDto,
    );
    expect(me).toMatchObject({
      promo: "1A · MCSI · Alternance",
      rhythm: "alternance",
      level: { alternanceOnly: false },
    });

    const refused = await call("PUT", "/v1/me/class", student.id, {
      levelId: first.id,
      trackId: secu,
      rhythm: "initial",
    });
    expect(refused.status).toBe(422);
    expect(await readError(refused)).toMatchObject({
      code: "TRACK_NOT_OFFERED",
      message: "Cette filière n'est pas proposée en 1A.",
    });
  });

  it("puts every 3A student in work-study, without repeating it in the label", async () => {
    const secu = await track("Sécurité");
    const third = await levelWith("3A", true, [secu]);
    const me = await readJson(
      await call("PUT", "/v1/me/class", student.id, {
        levelId: third.id,
        trackId: secu,
        rhythm: "initial",
      }),
      MeDto,
    );
    expect(me).toMatchObject({ promo: "3A · Sécurité", rhythm: "alternance" });
  });

  it("moves a year's students to work-study when it becomes alternance-only", async () => {
    const fourth = await levelWith("4A", false, []);
    await call("PUT", "/v1/me/class", student.id, {
      levelId: fourth.id,
      trackId: null,
      rhythm: "initial",
    });
    let [row] = await getTestDb().select().from(user).where(eq(user.id, student.id));
    expect(row?.promo).toBe("4A · Initial");

    await call("PUT", `/v1/admin/levels/${fourth.id}`, admin.id, {
      name: "4A",
      alternanceOnly: true,
    });
    [row] = await getTestDb().select().from(user).where(eq(user.id, student.id));
    expect(row).toMatchObject({ rhythm: "alternance", promo: "4A" });
    const audit = await getTestDb()
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "class_level.updated"));
    expect(audit[0]?.payload).toMatchObject({ alternanceOnly: true });
  });

  it("refuses an unknown programme in the year's list", async () => {
    const res = await call("POST", "/v1/admin/levels", admin.id, {
      name: "5A",
      trackIds: ["00000000-0000-4000-8000-000000000000"],
    });
    expect(res.status).toBe(404);
  });
});

describe("profile photo", () => {
  const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70]);

  async function upload(userId: string, bytes: Uint8Array) {
    const headers = await authHeaders(userId);
    headers.set("content-type", "image/jpeg");
    return createTestApp().request("/v1/me/avatar", { method: "PUT", headers, body: bytes });
  }

  it("is stored, shown to anyone signed in, replaced and removed", async () => {
    const me = await readJson(await upload(student.id, JPEG), MeDto);
    expect(me.avatarUrl).toMatch(/^\/avatars\/[0-9a-f-]+\.jpg$/);
    const name = me.avatarUrl?.split("/").pop() ?? "";
    const other = await createUser();
    const served = await call("GET", `/v1/avatars/${name}`, other.id);
    expect(served.headers.get("content-type")).toBe("image/jpeg");
    expect((await call("GET", `/v1/avatars/${name}`, null)).status).toBe(401);

    await upload(student.id, JPEG);
    expect(testPhotos.files.has(name)).toBe(false);
    const removed = await readJson(await call("DELETE", "/v1/me/avatar", student.id), MeDto);
    expect(removed.avatarUrl).toBeNull();
  });

  it("refuses what is not an image", async () => {
    const res = await upload(student.id, new TextEncoder().encode("<svg onload=alert(1)>"));
    expect(res.status).toBe(400);
  });
});
