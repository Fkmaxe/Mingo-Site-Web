import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { describe, expect, it, vi } from "vitest";
import { readError } from "../test/http";
import { AppError, onError, onNotFound, throwOnValidationError } from "./errors";

function buildApp() {
  const app = new OpenAPIHono({ defaultHook: throwOnValidationError });
  app.onError(onError);
  app.notFound(onNotFound);
  app.openapi(
    createRoute({
      method: "post",
      path: "/echo",
      request: {
        body: {
          content: { "application/json": { schema: z.object({ name: z.string().min(1) }) } },
        },
      },
      responses: { 200: { description: "ok" } },
    }),
    (c) => c.json(c.req.valid("json"), 200),
  );
  app.get("/app-error", () => {
    throw new AppError("FORBIDDEN", 403, "Accès refusé.");
  });
  app.get("/crash", () => {
    throw new Error("SELECT * FROM secret failed");
  });
  return app;
}

const post = (body: string) =>
  buildApp().request("/echo", {
    method: "POST",
    body,
    headers: { "content-type": "application/json" },
  });

describe("error handling", () => {
  it("returns 400 VALIDATION_ERROR with Zod issues", async () => {
    const res = await post(JSON.stringify({ name: "" }));
    expect(res.status).toBe(400);
    const error = await readError(res);
    expect(error.code).toBe("VALIDATION_ERROR");
    const details = z.object({ issues: z.array(z.object({ path: z.array(z.string()) })) });
    expect(details.parse(error.details).issues[0]?.path).toEqual(["name"]);
  });

  it("returns 400 VALIDATION_ERROR on malformed JSON", async () => {
    const res = await post("{not json");
    expect(res.status).toBe(400);
    expect((await readError(res)).code).toBe("VALIDATION_ERROR");
  });

  it("maps AppError to its status and code", async () => {
    const res = await buildApp().request("/app-error");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: "FORBIDDEN", message: "Accès refusé." } });
  });

  it("hides unexpected errors behind a generic 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await buildApp().request("/crash");
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toContain("INTERNAL_ERROR");
    expect(text).not.toContain("SELECT");
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("returns 404 NOT_FOUND for unknown routes", async () => {
    const res = await buildApp().request("/nope");
    expect(res.status).toBe(404);
    expect((await readError(res)).code).toBe("NOT_FOUND");
  });
});
