// Source: packages/shared/src/middleware/validate.ts (lines 15-29)
// Listing id: validate-json
// Caption: Zod-based validateJson middleware (structured errors)
export function validateJson<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): Result<z.infer<T>> {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      ok: false as const,
      error: result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }
  return { ok: true as const, value: result.data };
}
