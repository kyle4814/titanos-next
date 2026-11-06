// The Worker entry. A Worker module may export ONLY handlers (fetch/scheduled): index.ts also exports helpers (handle, health, SERVICE)
// for the tests, which workerd rejects as an entry ("Incorrect type for map entry 'SERVICE'"). This file re-exports the default alone.
import worker from "./index.ts";
export default worker;
