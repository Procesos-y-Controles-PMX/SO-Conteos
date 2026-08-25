import { redirect } from "next/navigation";

export default function HomePage() {
  const portal = (process.env.NEXT_PUBLIC_PORTAL_URL || "").trim().replace(/\/$/, "");
  redirect(portal ? `${portal}/login?app=conteos` : "/login");
}
