import { MeDto, PHOTO_TYPES, UpdateClassInput, UpdateProfileInput } from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx, requireAuth } from "../../core/context";
import { AppError, throwOnValidationError } from "../../core/errors";
import { errorResponse } from "../../core/http";
import type { PhotoStore } from "../../lib/storage";
import { getMe, removeAvatar, setAvatar, updateClass, updateProfile } from "./me.service";

const meResponse = (description: string) => ({
  content: { "application/json": { schema: MeDto } },
  description,
});

const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  tags: ["me"],
  middleware: [requireAuth] as const,
  responses: {
    200: meResponse("Utilisateur connecté, ses rôles de l'année en cours"),
    401: errorResponse("Pas de session"),
  },
});

// Anyone signed in, on their own account only.
const updateMeRoute = createRoute({
  method: "patch",
  path: "/me",
  tags: ["me"],
  middleware: [requireAuth] as const,
  request: { body: { content: { "application/json": { schema: UpdateProfileInput } } } },
  responses: {
    200: meResponse("Profil modifié"),
    400: errorResponse("Données invalides"),
    401: errorResponse("Pas de session"),
  },
});

const Binary = z.string().meta({ format: "binary" });

const updateClassRoute = createRoute({
  method: "put",
  path: "/me/class",
  tags: ["me"],
  middleware: [requireAuth] as const,
  request: {
    body: { content: { "application/json": { schema: UpdateClassInput } }, required: true },
  },
  responses: {
    200: meResponse("Classe enregistrée"),
    400: errorResponse("Données invalides"),
    401: errorResponse("Pas de session"),
    404: errorResponse("Niveau ou filière introuvable"),
    422: errorResponse("TRACK_NOT_OFFERED"),
  },
});

const setAvatarRoute = createRoute({
  method: "put",
  path: "/me/avatar",
  tags: ["me"],
  middleware: [requireAuth] as const,
  request: {
    body: {
      content: Object.fromEntries(PHOTO_TYPES.map((t) => [t, { schema: Binary }])),
      required: true,
      description: "L'image (3 Mo au plus), recadrée et réduite par le navigateur",
    },
  },
  responses: {
    200: meResponse("Photo de profil enregistrée"),
    400: errorResponse("Pas une image, ou trop lourde"),
    401: errorResponse("Pas de session"),
  },
});

const removeAvatarRoute = createRoute({
  method: "delete",
  path: "/me/avatar",
  tags: ["me"],
  middleware: [requireAuth] as const,
  responses: { 200: meResponse("Photo retirée"), 401: errorResponse("Pas de session") },
});

// Profile photos are shown to every signed-in person (directory, league, teams).
const avatarRoute = createRoute({
  method: "get",
  path: "/avatars/{name}",
  tags: ["me"],
  middleware: [requireAuth] as const,
  request: { params: z.object({ name: z.string().max(64) }) },
  responses: {
    200: {
      content: Object.fromEntries(PHOTO_TYPES.map((t) => [t, { schema: Binary }])),
      description: "Photo de profil",
    },
    401: errorResponse("Pas de session"),
    404: errorResponse("Photo introuvable"),
  },
});

export function createMeRouter(photos: PhotoStore) {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(getMeRoute, async (c) => c.json(await getMe(authedCtx(c.get("ctx"))), 200))
    .openapi(updateMeRoute, async (c) =>
      c.json(await updateProfile(authedCtx(c.get("ctx")), c.req.valid("json")), 200),
    )
    .openapi(updateClassRoute, async (c) =>
      c.json(await updateClass(authedCtx(c.get("ctx")), c.req.valid("json")), 200),
    )
    .openapi(setAvatarRoute, async (c) =>
      c.json(
        await setAvatar(authedCtx(c.get("ctx")), photos, new Uint8Array(await c.req.arrayBuffer())),
        200,
      ),
    )
    .openapi(removeAvatarRoute, async (c) =>
      c.json(await removeAvatar(authedCtx(c.get("ctx")), photos), 200),
    )
    .openapi(avatarRoute, async (c) => {
      const photo = await photos.read(c.req.valid("param").name);
      if (!photo) throw new AppError("NOT_FOUND", 404, "Cette photo n'existe pas.");
      return new Response(photo.bytes, {
        headers: {
          "content-type": photo.type,
          "cache-control": "private, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        },
      });
    });
}
