import { z } from 'zod';

/**
 * ============================
 * BUSINESS SETUP VALIDATION
 * ============================
 *
 * This file defines Zod schemas used to validate
 * business-related data submitted by users.
 *
 * These schemas:
 * - Protect the backend from invalid data
 * - Define a clear contract between frontend and backend
 * - Serve as a single source of truth for input shapes
 */

/**
 * Schema for creating or configuring a business
 *
 * This data is used by the AI system to understand:
 * - What the business does
 * - How it prices its services
 * - What goals the AI replies should optimize for
 */
export const CreateBusinessSchema = z.object({
  // Type of business (e.g. "restaurant", "e-commerce", "consulting")
  // Must be descriptive enough to guide AI behavior
  businessType: z.string().min(2),

  // Short description explaining what the business offers
  // Used by AI for context and tone
  description: z.string().min(10),

  /**
   * Pricing information
   * Helps the AI avoid hallucinating unrealistic prices
   *
   * Stored as free text: the dashboard exposes a single textarea and the
   * prompt builder consumes the JSON as-is, so `{ text }` is the canonical
   * shape across frontend, API, and DB.
   */
  pricingRanges: z.object({
    text: z.string().max(2000),
  }),

  /**
   * Primary goals the business wants the AI to focus on
   *
   * - sell: convert conversations into sales
   * - book: schedule appointments or meetings
   * - support: answer questions and help customers
   *
   * At least one goal must be selected
   */
  primaryGoals: z.array(
    z.enum(['sell', 'book', 'support'])
  ).min(1),

  /**
   * Optional list of claims the AI is allowed to make
   * Example:
   * - "Free shipping available"
   * - "24/7 customer support"
   *
   * This helps prevent the AI from making false promises
   */
  allowedClaims: z.array(z.string()).optional(),

  /**
   * Optional business constraints or rules
   *
   * This can include:
   * - Legal constraints
   * - Policy rules
   * - Special instructions for AI behavior
   *
   * Stored as key-value pairs for flexibility
   */
  constraints: z.record(z.any(), z.string()).optional(),
});

/**
 * Schema for PUT /business/profile — the dashboard's flat profile form.
 *
 * Every field is optional: the controller only overwrites what the request
 * actually contains, so a partial save never resets other columns
 * (primaryGoals, allowedClaims, ...) to hardcoded defaults.
 */
export const UpdateProfileSchema = z.object({
  // Empty string = "not chosen yet" in the dashboard select — treated as absent
  businessType: z.union([z.string().min(2), z.literal('')]).optional(),
  description: z.string().optional(),
  targetAudience: z.string().max(500).optional(),
  pricing: z.string().max(2000).optional(),
});

/**
 * ============================
 * FAQ CREATION VALIDATION
 * ============================
 *
 * This schema defines the structure of a single FAQ
 * that will be used by the AI to answer customer questions.
 */
export const CreateFAQSchema = z.object({
  // Question asked by customers
  question: z.string().min(5),

  // Approved answer the AI is allowed to use
  answer: z.string().min(10),

  /**
   * Optional tags used for:
   * - Categorization
   * - Search
   * - Future semantic retrieval
   */
  tags: z.array(z.string()).optional(),

  /**
   * Indicates whether this FAQ was manually approved
   * by the business owner.
   *
   * This can be used to:
   * - Prioritize trusted answers
   * - Control AI behavior in sensitive contexts
   */
  manuallyApproved: z.boolean().optional(), // NEW: Manual approval flag
});

/**
 * ============================
 * INFERRED INPUT TYPES
 * ============================
 *
 * These TypeScript types are automatically generated
 * from the Zod schemas above.
 *
 * This ensures:
 * - No duplicated interfaces
 * - Type safety across the app
 * - Validation and types always match
 */

// Type representing valid business creation input
export type CreateBusinessInput = z.infer<typeof CreateBusinessSchema>;

// Type representing a valid partial profile update (PUT /business/profile)
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

// Type representing valid FAQ creation input
export type CreateFAQInput = z.infer<typeof CreateFAQSchema>;
