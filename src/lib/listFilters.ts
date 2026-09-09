/** Общие мелочи для фильтрации списков в админке. */

/** Регистронезависимое совпадение запроса хотя бы с одним из полей. */
export function textMatches(
  query: string,
  fields: (string | null | undefined)[],
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((field) => field?.toLowerCase().includes(q));
}
