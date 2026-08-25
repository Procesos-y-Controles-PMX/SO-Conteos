import { isMajorAdminEmail } from "@/lib/access";
import { fail, ok } from "@/lib/api/http";
import { fetchSoAccounts } from "@/lib/so-accounts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const viewer = new URL(request.url).searchParams.get("viewer");
  if (!isMajorAdminEmail(viewer)) {
    return fail("No autorizado.", 403);
  }

  try {
    const result = await fetchSoAccounts();
    return ok(result);
  } catch (err) {
    console.error("[cuentas]", err);
    return fail("No se pudieron cargar las cuentas.", 500);
  }
}
