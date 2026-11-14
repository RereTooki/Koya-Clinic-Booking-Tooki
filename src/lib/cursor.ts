type Cursor = { created_at: string; id: string };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(value: string): Cursor | null {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as Cursor).created_at !== "string" ||
      typeof (parsed as Cursor).id !== "string" ||
      !(parsed as Cursor).id ||
      !UUID_PATTERN.test((parsed as Cursor).id) ||
      Number.isNaN(Date.parse((parsed as Cursor).created_at))
    ) {
      return null;
    }
    return parsed as Cursor;
  } catch {
    return null;
  }
}
