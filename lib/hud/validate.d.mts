import type { FeedItem } from "./data";
export function validateFeed(d: unknown): { generated: number; items: FeedItem[] } | null;
