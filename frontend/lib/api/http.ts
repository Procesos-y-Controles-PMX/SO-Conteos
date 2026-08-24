import { NextResponse } from "next/server";
import { createSupabaseServerClient, missingSupabaseServerEnv } from "@/lib/supabase-server";
import type { SupabaseClient } from "@supabase/supabase-js";

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export function ok<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status });
}

export function dbOrError(): { supabase: SupabaseClient } | { response: NextResponse } {
  const supabase = createSupabaseServerClient();
  if (!supabase) {
    const missing = missingSupabaseServerEnv();
    return {
      response: fail(
        missing.length
          ? `Faltan variables: ${missing.join(", ")}.`
          : "Servidor sin base de datos.",
        500,
      ),
    };
  }
  return { supabase };
}
