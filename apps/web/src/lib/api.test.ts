import { describe, expect, it, vi } from "vitest";

const redirect = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("./server-env", () => ({ env: { API_URL: "http://api" } }));

const { NO_SCHOOL_YEAR_PATH, noSchoolYear } = await import("./api");

const run = (method: string, status: number, body: unknown) =>
  noSchoolYear.onResponse?.({
    request: new Request("http://api/v1/x", { method }),
    response: new Response(JSON.stringify(body), { status }),
    options: {} as never,
    schemaPath: "/v1/x",
    params: {},
    id: "1",
  });

describe("no current school year", () => {
  it("sends a page read to the explanation page", async () => {
    await run("GET", 422, { error: { code: "NO_CURRENT_SCHOOL_YEAR", message: "x" } });
    expect(redirect).toHaveBeenCalledWith(NO_SCHOOL_YEAR_PATH);
  });

  it("leaves other errors and writes alone", async () => {
    redirect.mockClear();
    await run("GET", 422, { error: { code: "VALIDATION_ERROR", message: "x" } });
    await run("POST", 422, { error: { code: "NO_CURRENT_SCHOOL_YEAR", message: "x" } });
    await run("GET", 200, {});
    expect(redirect).not.toHaveBeenCalled();
  });
});
