// prebuild: ship the first-paint feed as a public file too, so a refresh job can replace just /hud/feed.json on gh-pages.
import { copyFileSync, mkdirSync } from "node:fs";
mkdirSync("public/hud", { recursive: true });
copyFileSync("lib/hud/feed.json", "public/hud/feed.json");
