// SYNTHETIC fixture: passes every rule.
const C = { color: "var(--text)", background: "var(--vault-black)", fontSize: 16 };
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<label style={{ display: "block" }}><span>{label}</span>{children}</label>);
}
export default function Page() {
  return (
    <main id="main">
      <h1>Title</h1>
      <h2>Section</h2>
      <h3>Sub</h3>
      <img src="/a.png" alt="A chart" />
      <img src="/b.png" alt="" />
      <label htmlFor="x">Name</label>
      <input id="x" />
      <input aria-label="Email" type="email" />
      <input type="hidden" name="h" />
      <Field label="Hours"><input type="number" /></Field>
      <button type="button">Save</button>
      <button aria-label="Close"><svg /></button>
      <div tabIndex={0} style={C} />
      <p style={{ color: "var(--gold)", fontSize: 28 }}>Large gold</p>
    </main>
  );
}
