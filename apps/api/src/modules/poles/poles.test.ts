import { PoleDto } from "@bde/shared";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestApp } from "../../test/env";
import { createPole } from "../../test/factories";
import { readJson } from "../../test/http";

describe("GET /v1/poles", () => {
  it("lists poles by name, without authentication", async () => {
    await createPole({ slug: "sport", name: "Sport" });
    await createPole({ slug: "communication", name: "Communication" });
    const res = await createTestApp().request("/v1/poles");
    expect(res.status).toBe(200);
    const poles = await readJson(res, z.array(PoleDto));
    expect(poles.map((p) => p.name)).toEqual(["Communication", "Sport"]);
  });
});
