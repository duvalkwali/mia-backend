import { z } from 'zod';

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  businessName: z.string().min(2),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    tenantId: string;
    role: string;
  };
}
