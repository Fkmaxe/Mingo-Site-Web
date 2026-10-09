import {
  AdjustQuantityInput,
  CheckoutInput,
  CreateItemInput,
  CreateLocationInput,
  HistoryQuery,
  ItemDto,
  ListItemsQuery,
  LocationDto,
  MovementDto,
  NoteInput,
  PHOTO_TYPES,
  ReturnInput,
  UpdateItemInput,
} from "@bde/shared";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { type AppEnv, authedCtx } from "../../core/context";
import { AppError, throwOnValidationError } from "../../core/errors";
import { errorResponse, paginated } from "../../core/http";
import { requirePermission } from "../../core/permissions";
import type { PhotoStore } from "../../lib/storage";
import {
  adjustQuantity,
  archiveItem,
  checkoutItem,
  createItem,
  createLocation,
  editItem,
  getItem,
  listCategories,
  listHistory,
  listItems,
  listLocations,
  removePhoto,
  restoreItem,
  returnCheckout,
  setPhoto,
} from "./inventory.service";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});
const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { "application/json": { schema } }, required: true },
});
const Id = z.object({ id: z.uuid() });
const common = { 401: errorResponse("Pas de session"), 403: errorResponse("Réservé aux membres") };
const itemErrors = {
  ...common,
  400: errorResponse("Données invalides"),
  404: errorResponse("Objet introuvable"),
  409: errorResponse("NOT_AVAILABLE ou objet archivé"),
};
const Binary = z.string().meta({ format: "binary" });

const listRoute = createRoute({
  method: "get",
  path: "/inventory/items",
  tags: ["inventory"],
  middleware: [requirePermission("inventory:manage")] as const,
  request: { query: ListItemsQuery },
  responses: { 200: json(z.array(ItemDto), "Matériel (500 au plus)"), ...common },
});

const createItemRoute = createRoute({
  method: "post",
  path: "/inventory/items",
  tags: ["inventory"],
  middleware: [requirePermission("inventory:manage")] as const,
  request: body(CreateItemInput),
  responses: { 201: json(ItemDto, "Objet ajouté"), ...itemErrors },
});

const getItemRoute = createRoute({
  method: "get",
  path: "/inventory/items/{id}",
  tags: ["inventory"],
  middleware: [requirePermission("inventory:manage")] as const,
  request: { params: Id },
  responses: { 200: json(ItemDto, "Objet"), ...itemErrors },
});

const editItemRoute = createRoute({
  method: "patch",
  path: "/inventory/items/{id}",
  tags: ["inventory"],
  middleware: [requirePermission("inventory:manage")] as const,
  request: { params: Id, ...body(UpdateItemInput) },
  responses: { 200: json(ItemDto, "Objet modifié (historisé)"), ...itemErrors },
});

const adjustRoute = createRoute({
  method: "post",
  path: "/inventory/items/{id}/adjust",
  tags: ["inventory"],
  middleware: [requirePermission("inventory:manage")] as const,
  request: { params: Id, ...body(AdjustQuantityInput) },
  responses: { 200: json(ItemDto, "Stock ajusté"), ...itemErrors },
});

const checkoutRoute = createRoute({
  method: "post",
  path: "/inventory/items/{id}/checkouts",
  tags: ["inventory"],
  middleware: [requirePermission("inventory:manage")] as const,
  request: { params: Id, ...body(CheckoutInput) },
  responses: { 200: json(ItemDto, "Sorti"), ...itemErrors },
});

const returnRoute = createRoute({
  method: "post",
  path: "/inventory/checkouts/{id}/return",
  tags: ["inventory"],
  middleware: [requirePermission("inventory:manage")] as const,
  request: { params: Id, ...body(ReturnInput) },
  responses: { 200: json(ItemDto, "Rendu"), ...itemErrors },
});

const archiveRoute = createRoute({
  method: "post",
  path: "/inventory/items/{id}/archive",
  tags: ["inventory"],
  middleware: [requirePermission("inventory:archive")] as const,
  request: { params: Id, ...body(NoteInput) },
  responses: { 200: json(ItemDto, "Archivé"), ...itemErrors },
});

const restoreRoute = createRoute({
  method: "post",
  path: "/inventory/items/{id}/restore",
  tags: ["inventory"],
  middleware: [requirePermission("inventory:archive")] as const,
  request: { params: Id },
  responses: { 200: json(ItemDto, "Restauré"), ...itemErrors },
});

const photoUploadRoute = createRoute({
  method: "put",
  path: "/inventory/items/{id}/photo",
  tags: ["inventory"],
  middleware: [requirePermission("inventory:manage")] as const,
  request: {
    params: Id,
    body: {
      content: Object.fromEntries(PHOTO_TYPES.map((t) => [t, { schema: Binary }])),
      required: true,
      description: "L'image elle-même (3 Mo au plus), réduite par le navigateur",
    },
  },
  responses: { 200: json(ItemDto, "Photo enregistrée"), ...itemErrors },
});

const photoDeleteRoute = createRoute({
  method: "delete",
  path: "/inventory/items/{id}/photo",
  tags: ["inventory"],
  middleware: [requirePermission("inventory:manage")] as const,
  request: { params: Id },
  responses: { 200: json(ItemDto, "Photo retirée"), ...itemErrors },
});

const photoRoute = createRoute({
  method: "get",
  path: "/inventory/photos/{name}",
  tags: ["inventory"],
  middleware: [requirePermission("inventory:manage")] as const,
  request: { params: z.object({ name: z.string().max(64) }) },
  responses: {
    200: {
      content: Object.fromEntries(PHOTO_TYPES.map((t) => [t, { schema: Binary }])),
      description: "Photo",
    },
    ...common,
    404: errorResponse("Photo introuvable"),
  },
});

const historyRoute = createRoute({
  method: "get",
  path: "/inventory/history",
  tags: ["inventory"],
  middleware: [requirePermission("inventory:manage")] as const,
  request: { query: HistoryQuery.extend({ itemId: z.uuid().optional() }) },
  responses: { 200: json(paginated(MovementDto), "Historique, le plus récent d'abord"), ...common },
});

const locationsRoute = createRoute({
  method: "get",
  path: "/inventory/locations",
  tags: ["inventory"],
  middleware: [requirePermission("inventory:manage")] as const,
  responses: { 200: json(z.array(LocationDto), "Lieux de rangement"), ...common },
});

const createLocationRoute = createRoute({
  method: "post",
  path: "/inventory/locations",
  tags: ["inventory"],
  middleware: [requirePermission("inventory:manage")] as const,
  request: body(CreateLocationInput),
  responses: {
    201: json(z.array(LocationDto), "Lieu ajouté"),
    ...common,
    400: errorResponse("Nom invalide"),
    409: errorResponse("ALREADY_EXISTS"),
  },
});

const categoriesRoute = createRoute({
  method: "get",
  path: "/inventory/categories",
  tags: ["inventory"],
  middleware: [requirePermission("inventory:manage")] as const,
  responses: { 200: json(z.array(z.string()), "Catégories déjà utilisées"), ...common },
});

export function createInventoryRouter(photos: PhotoStore) {
  return new OpenAPIHono<AppEnv>({ defaultHook: throwOnValidationError })
    .openapi(listRoute, async (c) =>
      c.json(await listItems(authedCtx(c.get("ctx")), c.req.valid("query")), 200),
    )
    .openapi(createItemRoute, async (c) =>
      c.json(await createItem(authedCtx(c.get("ctx")), c.req.valid("json")), 201),
    )
    .openapi(getItemRoute, async (c) =>
      c.json(await getItem(authedCtx(c.get("ctx")), c.req.valid("param").id), 200),
    )
    .openapi(editItemRoute, async (c) => {
      const { note, ...rest } = c.req.valid("json");
      return c.json(
        await editItem(authedCtx(c.get("ctx")), c.req.valid("param").id, {
          ...rest,
          note: note ?? "",
        }),
        200,
      );
    })
    .openapi(adjustRoute, async (c) =>
      c.json(
        await adjustQuantity(authedCtx(c.get("ctx")), c.req.valid("param").id, c.req.valid("json")),
        200,
      ),
    )
    .openapi(checkoutRoute, async (c) =>
      c.json(
        await checkoutItem(authedCtx(c.get("ctx")), c.req.valid("param").id, c.req.valid("json")),
        200,
      ),
    )
    .openapi(returnRoute, async (c) =>
      c.json(
        await returnCheckout(authedCtx(c.get("ctx")), c.req.valid("param").id, c.req.valid("json")),
        200,
      ),
    )
    .openapi(archiveRoute, async (c) =>
      c.json(
        await archiveItem(
          authedCtx(c.get("ctx")),
          c.req.valid("param").id,
          c.req.valid("json").note,
        ),
        200,
      ),
    )
    .openapi(restoreRoute, async (c) =>
      c.json(await restoreItem(authedCtx(c.get("ctx")), c.req.valid("param").id), 200),
    )
    .openapi(photoUploadRoute, async (c) => {
      const bytes = new Uint8Array(await c.req.arrayBuffer());
      return c.json(
        await setPhoto(authedCtx(c.get("ctx")), photos, c.req.valid("param").id, bytes),
        200,
      );
    })
    .openapi(photoDeleteRoute, async (c) =>
      c.json(await removePhoto(authedCtx(c.get("ctx")), photos, c.req.valid("param").id), 200),
    )
    .openapi(photoRoute, async (c) => {
      const photo = await photos.read(c.req.valid("param").name);
      if (!photo) throw new AppError("NOT_FOUND", 404, "Cette photo n'existe pas.");
      // Names are random and never reused: the file can be cached for good.
      return new Response(photo.bytes, {
        headers: {
          "content-type": photo.type,
          "cache-control": "private, max-age=31536000, immutable",
          "x-content-type-options": "nosniff",
        },
      });
    })
    .openapi(historyRoute, async (c) =>
      c.json(await listHistory(authedCtx(c.get("ctx")), c.req.valid("query")), 200),
    )
    .openapi(locationsRoute, async (c) => c.json(await listLocations(authedCtx(c.get("ctx"))), 200))
    .openapi(createLocationRoute, async (c) =>
      c.json(await createLocation(authedCtx(c.get("ctx")), c.req.valid("json").name), 201),
    )
    .openapi(categoriesRoute, async (c) =>
      c.json(await listCategories(authedCtx(c.get("ctx"))), 200),
    );
}
