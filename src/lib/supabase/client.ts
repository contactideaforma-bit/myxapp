"use client";

import { createBrowserClient } from "@supabase/ssr";
import { DUREE_SESSION } from "./cookies";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // La session survit a la fermeture de l'app et se rafraichit seule.
      cookieOptions: {
        maxAge: DUREE_SESSION,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
}
