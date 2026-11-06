// F-66: words that mark an ask as being about something other than this business (other companies, everyday life, general knowledge).
// Deterministic, 0 model calls. A cue only matters when the ask's tie to the top shelf is a lone word (see router.ts guard); a test asserts no cue is a word any shelf names in its keywords or title.
import { tokens } from "./text.ts";
const RAW = `weather forecast rain temperature cooking boil bake pizza burger calories diet
netflix spotify youtube disney uber airbnb amazon ebay paypal telstra optus vodafone woolworths coles aldi bunnings qantas virgin jetstar
toyota ford holden mazda tesla car engine tyre bicycle hotel holiday bali visa passport parcel
apple iphone android samsung xbox playstation nintendo facebook instagram tiktok whatsapp quickbooks salesforce aws 
ato centrelink medicare rent 
cricket football soccer rugby footy nrl afl tennis basketball movie film music song guitar piano poem joke homework
dentist doctor pharmacy fitness garden pet dog cat 
prime minister president translate french 
bitcoin crypto stocks currency exchange lottery`;
export const OFFTOPIC_CUES: Set<string> = new Set(RAW.split(/\s+/).flatMap((w) => tokens(w)));
