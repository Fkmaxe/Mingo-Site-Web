import { z } from "zod";
import { INVENTORY_ACTIONS, ITEM_CONDITIONS, ITEM_KINDS } from "../enums";

/** Code written on the label: INV-0042. */
export function itemCode(number: number): string {
  return `INV-${String(number).padStart(4, "0")}`;
}

/** "INV-0042", "inv42", "42" -> 42; null when it is not a code. */
export function parseItemCode(text: string): number | null {
  const match = text.trim().match(/^(?:inv-?)?0*(\d{1,7})$/i);
  return match?.[1] ? Number(match[1]) : null;
}

const Ref = z.object({ id: z.uuid(), name: z.string() });
const Condition = z.enum(ITEM_CONDITIONS);
const Note = z.string().trim().max(500, "500 caractères maximum").default("");

export const LocationDto = z
  .object({ id: z.uuid(), name: z.string(), itemCount: z.int() })
  .meta({ id: "InventoryLocation" });
export type LocationDto = z.infer<typeof LocationDto>;

export const CreateLocationInput = z
  .object({ name: z.string().trim().min(2, "Nom trop court").max(60, "60 caractères maximum") })
  .meta({ id: "CreateLocationInput" });

export const CategoryDto = z
  .object({ id: z.uuid(), name: z.string(), itemCount: z.int() })
  .meta({ id: "InventoryCategory" });
export type CategoryDto = z.infer<typeof CategoryDto>;

export const CreateCategoryInput = z
  .object({ name: z.string().trim().min(2, "Nom trop court").max(60, "60 caractères maximum") })
  .meta({ id: "CreateCategoryInput" });

export const CheckoutDto = z
  .object({
    id: z.uuid(),
    quantity: z.int(),
    holder: z.string(),
    event: z.object({ id: z.uuid(), title: z.string() }).nullable(),
    dueAt: z.iso.datetime().nullable(),
    note: z.string(),
    outAt: z.iso.datetime(),
    outBy: Ref.nullable(),
    /** Due date passed and not returned. */
    overdue: z.boolean(),
  })
  .meta({ id: "InventoryCheckout" });
export type CheckoutDto = z.infer<typeof CheckoutDto>;

export const ItemDto = z
  .object({
    id: z.uuid(),
    number: z.int(),
    code: z.string(),
    name: z.string(),
    description: z.string(),
    category: Ref.nullable(),
    kind: z.enum(ITEM_KINDS),
    quantity: z.int(),
    /** Quantity not taken out. */
    available: z.int(),
    condition: Condition,
    location: Ref.nullable(),
    pole: Ref.nullable(),
    /** Path of the photo on the web origin, or null. */
    photoUrl: z.string().nullable(),
    checkouts: z.array(CheckoutDto),
    overdue: z.boolean(),
    archivedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: "InventoryItem" });
export type ItemDto = z.infer<typeof ItemDto>;

export const CreateItemInput = z
  .object({
    name: z.string().trim().min(1, "Donne un nom").max(120, "120 caractères maximum"),
    description: z.string().trim().max(2000, "2000 caractères maximum").default(""),
    categoryId: z.uuid().nullable().default(null),
    kind: z.enum(ITEM_KINDS).default("unique"),
    quantity: z.int("Quantité invalide").min(0).max(100_000).default(1),
    condition: Condition.default("good"),
    locationId: z.uuid().nullable().default(null),
    poleId: z.uuid().nullable().default(null),
  })
  .refine((v) => v.kind === "stock" || v.quantity === 1, {
    path: ["quantity"],
    message: "Un objet unique a une quantité de 1",
  })
  .meta({ id: "CreateItemInput" });
export type CreateItemInput = z.input<typeof CreateItemInput>;

/** Each changed field is written to the history (moved, condition changed, details…). */
export const UpdateItemInput = z
  .object({
    name: z.string().trim().min(1, "Donne un nom").max(120),
    description: z.string().trim().max(2000),
    categoryId: z.uuid().nullable(),
    condition: Condition,
    locationId: z.uuid().nullable(),
    poleId: z.uuid().nullable(),
    note: Note,
  })
  .partial()
  .meta({ id: "UpdateItemInput" });
export type UpdateItemInput = z.input<typeof UpdateItemInput>;

export const AdjustQuantityInput = z
  .object({
    /** +5 when buying, -3 when some were lost or thrown away. */
    delta: z
      .int("Nombre entier")
      .min(-100_000)
      .max(100_000)
      .refine((d) => d !== 0, "Indique une quantité"),
    note: Note,
  })
  .meta({ id: "AdjustQuantityInput" });

export const CheckoutInput = z
  .object({
    quantity: z.int().min(1, "Au moins 1").default(1),
    holder: z.string().trim().min(2, "Qui l'emprunte ?").max(120),
    eventId: z.uuid().nullable().default(null),
    dueAt: z.iso.datetime("Date de retour invalide").nullable().default(null),
    note: Note,
  })
  .meta({ id: "CheckoutInput" });
export type CheckoutInput = z.input<typeof CheckoutInput>;

export const ReturnInput = z
  .object({ condition: Condition, note: Note })
  .meta({ id: "ReturnInput" });

export const NoteInput = z.object({ note: Note }).meta({ id: "NoteInput" });

export const ITEM_STATUS_FILTERS = ["all", "available", "out", "overdue"] as const;

export const ListItemsQuery = z.object({
  /** Name, description, category, or a label code (INV-0042). */
  q: z.string().trim().max(100).optional(),
  locationId: z.uuid().optional(),
  condition: Condition.optional(),
  categoryId: z.uuid().optional(),
  status: z.enum(ITEM_STATUS_FILTERS).default("all"),
  archived: z.stringbool().default(false),
});

export const MovementDto = z
  .object({
    id: z.uuid(),
    action: z.enum(INVENTORY_ACTIONS),
    details: z.record(z.string(), z.unknown()),
    note: z.string(),
    createdAt: z.iso.datetime(),
    actor: Ref.nullable(),
    item: z.object({ id: z.uuid(), code: z.string(), name: z.string() }),
  })
  .meta({ id: "InventoryMovement" });
export type MovementDto = z.infer<typeof MovementDto>;

export const HistoryQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Photos are resized in the browser before upload: this is a generous ceiling. */
export const PHOTO_MAX_BYTES = 3 * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
