"use client";

import { useEffect, useState } from "react";
import { browserApi, completeLogin, errorText, loginTokenFromHash } from "@/lib/portal";

// The emailed link is /app/login#token=...: the token sits in the URL fragment so it never reaches any server log.
export default function LoginClient() {
  const [state, setState] = useState<"working" | "done" | "error">("working");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const token = loginTokenFromHash(window.location.hash);
    if (!token) { setState("error"); setMsg("This page opens from the login link in your email. Request one from any order page."); return; }
    history.replaceState(null, "", window.location.pathname);
    completeLogin(browserApi(), token).then(() => { setState("done"); window.location.href = "/app/billing"; }).catch((e) => { setState("error"); setMsg(errorText(e)); });
  }, []);
  return (
    <main style={{ minHeight: "60vh", padding: "120px 20px", color: "var(--text)", textAlign: "center" }}>
      <h1 style={{ color: "var(--ice)" }}>{state === "working" ? "Signing you in" : state === "done" ? "Signed in" : "Sign in"}</h1>
      {msg && <p role="alert">{msg}</p>}
    </main>
  );
}
