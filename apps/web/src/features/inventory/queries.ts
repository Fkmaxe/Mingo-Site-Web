import "server-only";
import { notFound } from "next/navigation";
import { api } from "@/lib/api";
import type { Item, Location, Movement } from "./types";

export type ItemFilters = {
  q?: string | undefined;
  status?: "all" | "available" | "out" | "overdue" | undefined;
  locationId?: string | undefined;
  archived?: boolean | undefined;
};

export async function listItems(filters: ItemFilters): Promise<Item[]> {
  const { data, response } = await (await api()).GET("/v1/inventory/items", {
    params: {
      query: {
        status: filters.status ?? "all",
        archived: filters.archived ? "true" : "false",
        ...(filters.q ? { q: filters.q } : {}),
        ...(filters.locationId ? { locationId: filters.locationId } : {}),
      },
    },
  });
  if (!data) throw new Error(`GET /v1/inventory/items a échoué (${response.status})`);
  return data;
}

export async function getItemOr404(id: string): Promise<Item> {
  const { data } = await (await api()).GET("/v1/inventory/items/{id}", {
    params: { path: { id } },
  });
  if (!data) notFound();
  return data;
}

export async function listLocations(): Promise<Location[]> {
  const { data, response } = await (await api()).GET("/v1/inventory/locations");
  if (!data) throw new Error(`GET /v1/inventory/locations a échoué (${response.status})`);
  return data;
}

export async function listCategories(): Promise<string[]> {
  const { data } = await (await api()).GET("/v1/inventory/categories");
  return data ?? [];
}

export async function listHistory(params: { itemId?: string; cursor?: string; limit?: number }) {
  const { data, response } = await (await api()).GET("/v1/inventory/history", {
    params: {
      query: {
        limit: params.limit ?? 50,
        ...(params.itemId ? { itemId: params.itemId } : {}),
        ...(params.cursor ? { cursor: params.cursor } : {}),
      },
    },
  });
  if (!data) throw new Error(`GET /v1/inventory/history a échoué (${response.status})`);
  return data as { items: Movement[]; nextCursor: string | null };
}
