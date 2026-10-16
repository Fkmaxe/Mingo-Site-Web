/**
 * Posts messages to the BDE's Discord server with a bot (REST API, no gateway connection: the
 * bot only writes). Implementations: the Discord API, disabled (no token), in-memory in tests.
 */

export type DiscordEmbed = {
  title?: string;
  url?: string;
  description?: string;
  color?: number;
  author?: { name: string; icon_url?: string };
  fields?: { name: string; value: string; inline?: boolean }[];
  image?: { url: string };
  thumbnail?: { url: string };
  footer?: { text: string; icon_url?: string };
  timestamp?: string;
};

/** A link button (style 5) under the message. */
export type DiscordLinkButton = { label: string; url: string; emoji?: string };

export type DiscordMessage = {
  content?: string;
  embeds: DiscordEmbed[];
  buttons?: DiscordLinkButton[];
  /** Roles the message may ping; nothing else ever pings (texts come from users). */
  pingRoleIds?: string[];
};

/** Channels of the server, from the .env: each one optional. */
export type DiscordChannels = {
  events?: { channelId: string; roleId?: string | undefined } | undefined;
  applications?: string | undefined;
  boardTasks?: string | undefined;
  /** Task channel of each pole, by pole slug. */
  poleTasks: Record<string, string>;
};

export interface Discord {
  enabled: boolean;
  channels: DiscordChannels;
  send(channelId: string, message: DiscordMessage): Promise<void>;
}

const API = "https://discord.com/api/v10";
const MAX_RETRIES = 3;

/** The request body Discord expects: link buttons in an action row, mentions locked down. */
export function toPayload(message: DiscordMessage) {
  return {
    ...(message.content ? { content: message.content } : {}),
    embeds: message.embeds,
    ...(message.buttons?.length
      ? {
          components: [
            {
              type: 1,
              components: message.buttons.map((b) => ({
                type: 2,
                style: 5,
                label: b.label,
                url: b.url,
                ...(b.emoji ? { emoji: { name: b.emoji } } : {}),
              })),
            },
          ],
        }
      : {}),
    allowed_mentions: { parse: [], roles: message.pingRoleIds ?? [] },
  };
}

export function createRestDiscord(
  token: string,
  channels: DiscordChannels,
  fetchImpl: typeof fetch = fetch,
): Discord {
  return {
    enabled: true,
    channels,
    async send(channelId, message) {
      const body = JSON.stringify(toPayload(message));
      for (let attempt = 0; ; attempt++) {
        const res = await fetchImpl(`${API}/channels/${channelId}/messages`, {
          method: "POST",
          headers: {
            authorization: `Bot ${token}`,
            "content-type": "application/json",
            "user-agent": "DiscordBot (BDE Mingo, 1.0)",
          },
          body,
        });
        if (res.ok) return;
        // Rate limited: Discord says how long to wait.
        if (res.status === 429 && attempt < MAX_RETRIES) {
          const data = (await res.json().catch(() => ({}))) as { retry_after?: unknown };
          const seconds = typeof data.retry_after === "number" ? data.retry_after : 1;
          await new Promise((r) => setTimeout(r, Math.min(seconds, 10) * 1000));
          continue;
        }
        const detail = await res.text().catch(() => "");
        throw new Error(
          `Discord ${res.status} sur le salon ${channelId} : ${detail.slice(0, 300)}`,
        );
      }
    },
  };
}

export function createDisabledDiscord(): Discord {
  return { enabled: false, channels: { poleTasks: {} }, send: async () => {} };
}

export type MemoryDiscord = Discord & { sent: { channelId: string; message: DiscordMessage }[] };

/** Test double: records the messages instead of posting them. */
export function createMemoryDiscord(channels: DiscordChannels): MemoryDiscord {
  const sent: MemoryDiscord["sent"] = [];
  return {
    enabled: true,
    channels,
    sent,
    async send(channelId, message) {
      sent.push({ channelId, message });
    },
  };
}
