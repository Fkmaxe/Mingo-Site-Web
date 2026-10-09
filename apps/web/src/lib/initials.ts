/** Avatar initials: "Jeanne" + "de La Tour" -> "JD". */
export function initials(firstName: string, lastName: string): string {
  return [firstName, lastName].map((part) => part.trim()[0]?.toUpperCase() ?? "").join("");
}
