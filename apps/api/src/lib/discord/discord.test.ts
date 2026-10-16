import { describe, expect, it, vi } from "vitest";
import { createRestDiscord, toPayload } from ".";

describe("toPayload", () => {
  it("puts link buttons in an action row and never pings anyone but the given roles", () => {
    const payload = toPayload({
      content: "<@&123456789012345678> nouvel événement",
      embeds: [{ title: "Gala" }],
      buttons: [{ label: "Voir", url: "https://bde.fr/events/gala" }],
      pingRoleIds: ["123456789012345678"],
    });
    expect(payload.components).toEqual([
      {
        type: 1,
        components: [{ type: 2, style: 5, label: "Voir", url: "https://bde.fr/events/gala" }],
      },
    ]);
    expect(payload.allowed_mentions).toEqual({ parse: [], roles: ["123456789012345678"] });
    expect(toPayload({ embeds: [] }).allowed_mentions).toEqual({ parse: [], roles: [] });
  });
});

describe("createRestDiscord", () => {
  it("posts with the bot token and waits when rate limited", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ retry_after: 0.01 }, { status: 429 }))
      .mockResolvedValueOnce(Response.json({ id: "1" }));
    const discord = createRestDiscord("secret", { poleTasks: {} }, fetchImpl);
    await discord.send("111111111111111111", { embeds: [{ title: "Salut" }] });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://discord.com/api/v10/channels/111111111111111111/messages");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bot secret");
  });

  it("fails loudly on other errors (the caller logs them)", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("Missing Access", { status: 403 }));
    const discord = createRestDiscord("secret", { poleTasks: {} }, fetchImpl);
    await expect(discord.send("111111111111111111", { embeds: [] })).rejects.toThrow("Discord 403");
  });
});
