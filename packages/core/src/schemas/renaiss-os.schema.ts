import { z } from "zod";

export const RenaissOsConfidenceSchema = z.enum(["prime", "high", "medium", "low"]).nullable();

export const RenaissOsTradeKindSchema = z.enum(["listing", "transaction"]);

export type RenaissOsConfidence = z.infer<typeof RenaissOsConfidenceSchema>;
export type RenaissOsTradeKind = z.infer<typeof RenaissOsTradeKindSchema>;
