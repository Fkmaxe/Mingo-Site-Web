import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "../../app";
import { testEnv } from "../../test/env";
import { readJson } from "../../test/http";

describe("GET /health", () => {
  it("returns ok", async () => {
    const res = await createApp({ env: testEnv }).request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

describe("OpenAPI", () => {
  it("serves the document and lists /health", async () => {
    const res = await createApp({ env: testEnv }).request("/v1/openapi.json");
    expect(res.status).toBe(200);
    const doc = await readJson(res, z.object({ paths: z.record(z.string(), z.unknown()) }));
    expect(doc.paths).toHaveProperty("/health");
  });

  it("disables the docs UI in production", async () => {
    const res = await createApp({ env: { ...testEnv, NODE_ENV: "production" } }).request(
      "/v1/docs",
    );
    expect(res.status).toBe(404);
  });
});
