export function cleanDateDisplayValue(value: unknown): string {
  return String(value ?? "").trim();
}

export function formatDateOnlyForDisplay(value: unknown): string {
  const text = cleanDateDisplayValue(value);
  if (!text) return "";

  const isoDateOnlyMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (isoDateOnlyMatch) {
    const [, year, month, day] = isoDateOnlyMatch;
    return `${Number(month)}/${Number(day)}/${year}`;
  }

  const dottedDateMatch = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dottedDateMatch) {
    const [, month, day, year] = dottedDateMatch;
    return `${Number(month)}/${Number(day)}/${year}`;
  }

  const slashDateMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashDateMatch) {
    const [, month, day, year] = slashDateMatch;
    return `${Number(month)}/${Number(day)}/${year}`;
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("en-US");
}
