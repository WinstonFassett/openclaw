import { z } from "zod";

export const McpServerSchema = z
  .object({
    name: z.string(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    cwd: z.string().optional(),
    url: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
    blocking: z.boolean().optional(),
  })
  .strict();

export const McpSchema = z
  .object({
    enabled: z.boolean().optional(),
    timeoutMs: z.number().int().positive().optional(),
    servers: z.record(z.string(), McpServerSchema).optional(),
    defaultServers: z.array(z.string()).optional(),
  })
  .strict()
  .optional();
