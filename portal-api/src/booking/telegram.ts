import type { Env } from "../env.ts";

// Sends one plain-text message to Kyle through the Telegram Bot API sendMessage. Nothing else is ever called on the bot (no polling,
// no webhook changes). The token sits only inside the request URL and is never logged or thrown.
// Returns undefined when either worker secret is missing, so the booking still works without an alert.
export function telegramNotifier(env: Pick<Env, "TELEGRAM_BOT_TOKEN" | "TELEGRAM_CHAT_ID">, fetchFn: typeof fetch = fetch): ((text: string) => Promise<void>) | undefined {
  const token = env.TELEGRAM_BOT_TOKEN?.trim(), chat = env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chat) return undefined;
  return async (text: string) => {
    let res: Response;
    try {
      res = await fetchFn(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: chat, text: text.slice(0, 3500), disable_web_page_preview: true }),
        signal: AbortSignal.timeout(4000),
      });
    } catch { throw new Error("telegram_unreachable"); }   // the original error can carry the URL, so it is dropped
    if (!res.ok) throw new Error("telegram_http_" + res.status);
  };
}
