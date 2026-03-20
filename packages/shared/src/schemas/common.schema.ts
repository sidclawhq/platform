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

export const EvaluateRequestSchema = z.object({
  operation: z.string().min(1),
  target_integration: z.string().min(1),
  resource_scope: z.string().min(1),
  data_classification: DataClassificationSchema,
  context: z.record(z.string(), z.unknown()).optional(),
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
