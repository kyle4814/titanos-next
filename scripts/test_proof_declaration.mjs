// test_proof_declaration.mjs - the first-visit Proof Declaration (PR #5) keeps its safety properties.
// Regression for the 2026-11-10 independent review P1: leaving "/" by client navigation left the scroll lock and the
// Escape listener live on a page with no visible dialog. Source-level checks; the live browser check runs after deploy.
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(resolve(root, "components/ProofDeclaration.tsx"), "utf8");
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log(`PASS ${name}`); } else { fail++; console.log(`FAIL ${name}`); } };
ok(/if \(pathname !== "\/"\) \{\s*setOpen\(false\);\s*return;\s*\}/.test(src), "leaving / closes the dialog (no scroll lock or key trap left behind)");
ok(/role="dialog"/.test(src) && /aria-modal="true"/.test(src), "the overlay is an aria-modal dialog");
ok(/aria-label="Close introduction"/.test(src) && /Escape/.test(src), "it has a labelled close button and an Escape path");
ok(/useState\(false\)/.test(src), "closed on the server render (no hydration mismatch in the static export)");
ok(/try \{[^}]*sessionStorage\.setItem/.test(src), "dismissal survives storage that throws (private browsing)");
ok(/href="\/proof"/.test(src) && existsSync(resolve(root, "app/proof/page.tsx")), "it links to /proof, and /proof exists");
ok(!/PARRALAX/i.test(src), "the brand line is spelled PARALLAX");
console.log(`== test_proof_declaration: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
