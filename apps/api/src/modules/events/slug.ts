import { randomBytes } from "node:crypto";

export function slugify(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "evenement";
}

/** Returns `base`, or `base-xxxx` with a random suffix when `base` is taken. */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let candidate = base;
  while (await exists(candidate)) {
    candidate = `${base}-${randomBytes(2).toString("hex")}`;
  }
  return candidate;
}
