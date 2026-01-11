import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  PORT: z.string().transform(Number),

  OPENAI_API_KEY: z.string(),

  OPENAI_FAST_MODEL: z.string(),
  OPENAI_REASONING_MODEL: z.string()
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
