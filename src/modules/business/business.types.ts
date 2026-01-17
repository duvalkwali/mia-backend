import { z } from 'zod';

export const CreateBusinessSchema = z.object({
  businessType: z.string().min(2),
  description: z.string().min(10),
  pricingRanges: z.object({
    min: z.number().positive(),
    max: z.number().positive(),
    currency: z.string().length(3),
  }),
  primaryGoals: z.array(z.enum(['sell', 'book', 'support'])).min(1),
  allowedClaims: z.array(z.string()).optional(),
  constraints: z.record(z.any(), z.string()).optional(),
});

export const CreateFAQSchema = z.object({
  question: z.string().min(5),
  answer: z.string().min(10),
  tags: z.array(z.string()).optional(),
  manuallyApproved: z.boolean().optional(),  // NEW: Manual approval flag
});

export type CreateBusinessInput = z.infer<typeof CreateBusinessSchema>;
export type CreateFAQInput = z.infer<typeof CreateFAQSchema>;
