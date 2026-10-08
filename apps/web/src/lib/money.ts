const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

/** 123456 -> "1 234,56 €" */
export function formatCents(cents: number): string {
  return euro.format(cents / 100);
}

/** "12,5" / "12.50" / "1 200" -> cents; null if it is not an amount with at most 2 decimals. */
export function parseEuros(input: string): number | null {
  const normalized = input.replace(/[\s €]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}
