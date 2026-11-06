// SYNTHETIC fixture: one violation per rule, in a fixed order.
export default function Page() {
  return (
    <div>
      <h1>Title</h1>
      <h3>Skipped</h3>
      <img src="/a.png" />
      <input type="text" />
      <button><svg /></button>
      <div tabIndex={3} />
      <p style={{ color: "#555555", background: "#000000", fontSize: 14 }}>Low contrast</p>
    </div>
  );
}
