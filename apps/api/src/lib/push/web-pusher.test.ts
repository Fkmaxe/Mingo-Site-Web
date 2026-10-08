import { createECDH, randomBytes } from "node:crypto";
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import webpush from "web-push";
import { createWebPusher } from "./web-pusher";

// A local stand-in for a browser push service: records requests, answers with `status`.
let status = 201;
const received: { headers: IncomingHttpHeaders; bytes: number }[] = [];
const server = createServer((req, res) => {
  let bytes = 0;
  req.on("data", (chunk: Buffer) => {
    bytes += chunk.length;
  });
  req.on("end", () => {
    received.push({ headers: req.headers, bytes });
    res.writeHead(status).end();
  });
});
let endpoint = "";

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}/push/abc`;
});
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

function browserKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    p256dh: ecdh.getPublicKey().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  };
}

describe("createWebPusher", () => {
  const vapid = webpush.generateVAPIDKeys();
  const pusher = createWebPusher({ ...vapid, subject: "mailto:bureau@bde-mingo.fr" });
  const message = { title: "Gala", body: "C'est demain", url: "/tickets/1" };

  it("sends an encrypted, VAPID-signed message", async () => {
    status = 201;
    expect(await pusher.send({ endpoint, ...browserKeys() }, message)).toBe("sent");
    const last = received.at(-1);
    expect(last?.headers["content-encoding"]).toBe("aes128gcm");
    expect(last?.headers.authorization).toMatch(new RegExp(`^vapid t=.+, k=${vapid.publicKey}$`));
    expect(last?.headers.ttl).toBe(String(24 * 3600));
    // Encrypted: the body is not the JSON payload.
    expect(last?.bytes).toBeGreaterThan(JSON.stringify(message).length);
    expect(pusher.publicKey).toBe(vapid.publicKey);
  });

  it("reports a revoked subscription as gone, other errors as failed", async () => {
    status = 410;
    expect(await pusher.send({ endpoint, ...browserKeys() }, message)).toBe("gone");
    status = 500;
    expect(await pusher.send({ endpoint, ...browserKeys() }, message)).toBe("failed");
  });
});
