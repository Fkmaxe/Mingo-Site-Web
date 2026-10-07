import { writeFileSync } from "node:fs";
import { createApp, OPENAPI_CONFIG } from "../app";
import { createDb } from "../db/client";
import { createMemoryMailer } from "../lib/mailer";

// Builds the OpenAPI document without starting the server nor touching the database
// (postgres.js connects lazily), so it also runs in CI.
const output = process.argv[2] ?? "openapi.json";
const { db, close } = createDb("postgres://unused@localhost:5432/unused");
const app = createApp({
  env: {
    NODE_ENV: "development",
    WEB_ORIGIN: "http://localhost:3000",
    BETTER_AUTH_SECRET: "openapi-export-openapi-export-openapi",
    BETTER_AUTH_URL: "http://localhost:3000",
  },
  db,
  mailer: createMemoryMailer(),
});
const document = app.getOpenAPI31Document(OPENAPI_CONFIG);
writeFileSync(output, `${JSON.stringify(document, null, 2)}\n`);
await close();
console.log(`Document OpenAPI écrit dans ${output}`);
