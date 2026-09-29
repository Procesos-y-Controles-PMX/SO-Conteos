import { ok } from "@/lib/api/http";
import { clearSessionCookie } from "@/lib/api/session";

export async function POST() {
  return clearSessionCookie(ok({}));
}
