import { z } from 'zod';
import { DataClassificationSchema, PolicyEffectSchema } from '../enums';

export const PaginationSchema = z.object({
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

export const ApiErrorSchema = z.object({
  error: z.string().min(1),
  message: z.string().min(1),
  status: z.number().int(),
  details: z.record(z.string(), z.unknown()).optional(),
  trace_id: z.string().optional(),
  request_id: z.string().min(1),
});

export type ApiErrorInput = z.infer<typeof ApiErrorSchema>;

/** Maximum size for the context JSON object (10 KB when stringified). */
const MAX_CONTEXT_BYTES = 10_240;

export const EvaluateRequestSchema = z.object({
  operation: z.string().min(1).max(1000, 'operation must be at most 1000 characters'),
  target_integration: z.string().min(1).max(1000, 'target_integration must be at most 1000 characters'),
  resource_scope: z.string().min(1).max(2000, 'resource_scope must be at most 2000 characters'),
  data_classification: DataClassificationSchema,
  context: z
    .record(z.string(), z.unknown())
    .optional()
    .refine(
      (ctx) => ctx === undefined || JSON.stringify(ctx).length <= MAX_CONTEXT_BYTES,
      `context must not exceed ${MAX_CONTEXT_BYTES} bytes when serialized`,
    ),
});

export type EvaluateRequestInput = z.infer<typeof EvaluateRequestSchema>;

export const EvaluateResponseSchema = z.object({
  decision: PolicyEffectSchema,
  trace_id: z.string().uuid(),
  approval_request_id: z.string().uuid().nullable(),
  reason: z.string().min(1),
  policy_rule_id: z.string().uuid().nullable(),
});

export type EvaluateResponseInput = z.infer<typeof EvaluateResponseSchema>;
