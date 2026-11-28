// Worker entry. Kept to ONE default export on purpose: workerd treats every named export of the entry module as a service
// entrypoint and refuses to start when one is a constant (found by running wrangler dev locally). The logic lives in app.ts.
import { createWorker } from "./app.ts";
export default createWorker();
