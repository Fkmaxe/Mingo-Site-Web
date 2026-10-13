import {
  composeName,
  type MeDto,
  PHOTO_MAX_BYTES,
  type UpdateClassData,
  type UpdateProfileInput,
} from "@bde/shared";
import { writeAudit } from "../../core/audit";
import type { AuthedCtx } from "../../core/context";
import { AppError } from "../../core/errors";
import { inTransaction } from "../../core/tx";
import { type PhotoStore, sniffPhotoType } from "../../lib/storage";
import { setOwnClass } from "../classes";
import { findCurrentMemberships, findUserById, setUserImage, updateUserNames } from "./me.repo";

/** Path on the web origin (the web proxies avatars: the browser never calls the API). */
export const avatarPath = (name: string) => `/avatars/${name}`;

const accountGone = () => new AppError("UNAUTHENTICATED", 401, "Ton compte n'existe plus.");

export async function getMe(ctx: AuthedCtx): Promise<MeDto> {
  const [user, memberships] = await Promise.all([
    findUserById(ctx.db, ctx.user.id),
    findCurrentMemberships(ctx.db, ctx.user.id),
  ]);
  if (!user) throw accountGone();
  const { image, level, track, ...rest } = user;
  return {
    ...rest,
    level: level?.id ? level : null,
    track: track?.id ? track : null,
    avatarUrl: image ? avatarPath(image) : null,
    memberships: memberships.map((m) => ({
      id: m.id,
      role: m.role,
      boardPosition: m.boardPosition,
      pole:
        m.poleId && m.poleSlug && m.poleName
          ? { id: m.poleId, slug: m.poleSlug, name: m.poleName }
          : null,
    })),
    roles: ctx.roles,
    permissions: [...ctx.permissions].sort(),
  };
}

/** Changes the user's own first and last name; `name` follows ("First Last"). */
export async function updateProfile(ctx: AuthedCtx, input: UpdateProfileInput): Promise<MeDto> {
  await inTransaction(ctx.db, async (tx) => {
    const before = await findUserById(tx, ctx.user.id);
    if (!before) throw accountGone();
    const after = {
      firstName: input.firstName,
      lastName: input.lastName,
      name: composeName(input.firstName, input.lastName),
    };
    if (before.firstName === after.firstName && before.lastName === after.lastName) return;
    await updateUserNames(tx, ctx.user.id, after);
    await writeAudit(tx, {
      actorUserId: ctx.user.id,
      action: "user.profile_updated",
      entity: "user",
      entityId: ctx.user.id,
      payload: {
        before: { firstName: before.firstName, lastName: before.lastName },
        after: { firstName: after.firstName, lastName: after.lastName },
      },
    });
  });
  return getMe(ctx);
}

/** The student's own year of study and programme. */
export async function updateClass(ctx: AuthedCtx, input: UpdateClassData): Promise<MeDto> {
  await setOwnClass(ctx, input);
  return getMe(ctx);
}

/** Profile photo (already cropped and resized by the browser); the previous file is removed. */
export async function setAvatar(
  ctx: AuthedCtx,
  photos: PhotoStore,
  bytes: Uint8Array,
): Promise<MeDto> {
  if (bytes.byteLength === 0 || bytes.byteLength > PHOTO_MAX_BYTES) {
    throw new AppError("VALIDATION_ERROR", 400, "La photo doit faire moins de 3 Mo.");
  }
  const type = sniffPhotoType(bytes);
  if (!type) throw new AppError("VALIDATION_ERROR", 400, "Envoie une photo JPEG, PNG ou WebP.");
  const before = await findUserById(ctx.db, ctx.user.id);
  if (!before) throw accountGone();
  const name = await photos.save(bytes, type);
  try {
    await setUserImage(ctx.db, ctx.user.id, name);
  } catch (error) {
    await photos.remove(name);
    throw error;
  }
  if (before.image) await photos.remove(before.image);
  return getMe(ctx);
}

export async function removeAvatar(ctx: AuthedCtx, photos: PhotoStore): Promise<MeDto> {
  const before = await findUserById(ctx.db, ctx.user.id);
  if (!before) throw accountGone();
  if (before.image) {
    await setUserImage(ctx.db, ctx.user.id, null);
    await photos.remove(before.image);
  }
  return getMe(ctx);
}
