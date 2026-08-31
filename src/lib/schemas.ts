import { z } from "zod";

export const idSchema = z.string().trim().min(1).max(128);

export const cursorSchema = z.string().trim().min(1).max(512).optional();

export const paginationSchema = z.object({
  cursor: cursorSchema,
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const messagePageQuerySchema = z.object({
  channelId: idSchema,
  cursor: cursorSchema,
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const createGuildSchema = z.object({
  name: z.string().trim().min(2).max(100),
});

export const messageContentSchema = z.object({
  content: z.string().trim().min(1).max(8000),
});

export type MessagePageQuery = z.infer<typeof messagePageQuerySchema>;
