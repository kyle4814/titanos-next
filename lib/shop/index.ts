import data from "./shelves.json";
import type { GradedShelf } from "./types";

// Only graded, passing shelves are ever in shelves.json (scripts/build_shop.mjs). Counts are read from the file itself.
export const SHOP: { counts: { total: number; graded_pass: number; graded_fail: number; ungraded_shown: number }; shelves: GradedShelf[] } =
  data as unknown as { counts: { total: number; graded_pass: number; graded_fail: number; ungraded_shown: number }; shelves: GradedShelf[] };
