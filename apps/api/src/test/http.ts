import { ApiErrorBody } from "@bde/shared";
import type { z } from "zod";

/** Parses a JSON response body with a schema, so tests stay typed and check the response shape. */
export async function readJson<T extends z.ZodType>(res: Response, schema: T): Promise<z.infer<T>> {
  return schema.parse(await res.json());
}

export async function readError(res: Response): Promise<ApiErrorBody["error"]> {
  return (await readJson(res, ApiErrorBody)).error;
}
