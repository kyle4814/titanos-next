import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Services | Titanos",
  alternates: { canonical: "https://titanos.tech/audit" },
};

export default function ServicesRedirect() {
  redirect("/audit");
}
