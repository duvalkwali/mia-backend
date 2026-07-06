import { z } from 'zod';

/**
 * ============================
 * AUTH INPUT VALIDATION SCHEMAS
 * ============================
 *
 * These Zod schemas define the expected shape and rules
 * for authentication-related requests.
 *
 * IMPORTANT:
 * - These schemas are used at RUNTIME to validate incoming data
 * - They also act as a SINGLE SOURCE OF TRUTH for TypeScript types
 */

/**
 * Schema for user registration (sign up)
 * This validates the request body when a user creates an account
 */
export const RegisterSchema = z.object({
  // User email address
  // - Must be a string
  // - Must follow a valid email format (e.g. user@example.com)
  email: z.string().email(),

  // User password
  // - Must be a string
  // - Must contain at least 8 characters
  password: z.string().min(8),

  // Business name associated with the tenant
  // - Required for multi-tenant setup
  // - Must be at least 2 characters long
  businessName: z.string().min(2),
});

/**
 * Schema for user login
 * This validates the request body when a user logs in
 */
export const LoginSchema = z.object({
  // Email used to identify the user
  email: z.string().email(),

  // Password provided by the user
  // (Length rules are not enforced here because
  // we are only checking credentials, not creating them)
  password: z.string(),
});

/**
 * ============================
 * INFERRED INPUT TYPES
 * ============================
 *
 * These TypeScript types are AUTOMATICALLY inferred
 * from the Zod schemas above.
 *
 * BENEFITS:
 * - No duplication of interfaces
 * - Validation and types always stay in sync
 * - Safer refactors
 */

/**
 * Type representing valid registration input
 * Derived directly from RegisterSchema
 */
export type RegisterInput = z.infer<typeof RegisterSchema>;

/**
 * Type representing valid login input
 * Derived directly from LoginSchema
 */
export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * ============================
 * AUTH RESPONSE CONTRACT
 * ============================
 *
 * This interface defines the structure of a successful
 * authentication response sent back to the client.
 *
 * It is NOT a Zod schema because:
 * - It is not user input
 * - It is controlled by the backend
 */
export interface AuthResponse {
  // JWT access token used for authenticated requests
  token: string;

  // Basic authenticated user information
  user: {
    // Unique user identifier
    id: string;

    // User email address
    email: string;

    // Tenant ID used for multi-tenant isolation
    tenantId: string;

    // User role (e.g. owner, admin, member)
    role: string;
  };
}
