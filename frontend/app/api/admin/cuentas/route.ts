import { fail, ok } from "@/lib/api/http";
import { requireSession } from "@/lib/api/session";
import { fetchSoAccounts } from "@/lib/so-accounts";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireSession("major");
  if ("response" in auth) return auth.response;

  try {
    const result = await fetchSoAccounts();
    return ok(result);
  } catch (err) {
    console.error("[cuentas]", err);
    return fail("No se pudieron cargar las cuentas.", 500);
  }
}
