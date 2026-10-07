import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  const schema = z.object({ PORT: z.coerce.number(), HOST: z.string() });

  it("returns the parsed values", () => {
    expect(parseEnv(schema, { PORT: "3001", HOST: "localhost" })).toEqual({
      PORT: 3001,
      HOST: "localhost",
    });
  });

  it("throws a French error naming each invalid variable", () => {
    expect(() => parseEnv(schema, {})).toThrow(/invalides[\s\S]*PORT[\s\S]*HOST/);
  });
});
