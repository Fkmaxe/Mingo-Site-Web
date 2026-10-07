import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createDb } from "../../db/client";
import { createTestApp, testEnv } from "../../test/env";
import { readJson } from "../../test/http";

describe("GET /health", () => {
  it("returns ok when the database answers", async () => {
    const res = await createTestApp().request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", database: "up" });
  });

  it("returns 503 when the database is unreachable", async () => {
    const unreachable = createDb("postgres://nobody:nobody@127.0.0.1:1/none", { max: 1 });
    const res = await createTestApp({ db: unreachable.db }).request("/health");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "degraded", database: "down" });
    await unreachable.close();
  });
});

describe("OpenAPI", () => {
  it("serves the document and lists /health", async () => {
    const res = await createTestApp().request("/v1/openapi.json");
    expect(res.status).toBe(200);
    const doc = await readJson(res, z.object({ paths: z.record(z.string(), z.unknown()) }));
    expect(doc.paths).toHaveProperty("/health");
  });

  it("disables the docs UI in production", async () => {
    const res = await createTestApp({ env: { ...testEnv, NODE_ENV: "production" } }).request(
      "/v1/docs",
    );
    expect(res.status).toBe(404);
  });
});
