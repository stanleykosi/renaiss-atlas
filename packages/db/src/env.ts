import { z } from "zod";

const booleanFromEnv = z.preprocess(
  (value) => (value == null || value === "" ? "false" : value),
  z.enum(["true", "false"]).transform((value) => value === "true")
);

export const DatabaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required for database operations"),
  DATABASE_SSL: booleanFromEnv.default(false)
});

export type DatabaseEnv = z.infer<typeof DatabaseEnvSchema>;

export function parseDatabaseEnv(input: Record<string, string | undefined>): DatabaseEnv {
  return DatabaseEnvSchema.parse(input);
}

