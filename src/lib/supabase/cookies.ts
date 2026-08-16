/**
 * Options de cookie partagees par le client, le serveur et le middleware.
 *
 * Sans maxAge explicite, @supabase/ssr pose des cookies de SESSION : le
 * navigateur les efface a la fermeture, et il faut se reconnecter. On les
 * rend persistants — 400 jours est le plafond impose par les navigateurs
 * (Chrome tronque au-dela).
 */
export const DUREE_SESSION = 400 * 24 * 60 * 60; // secondes

export const OPTIONS_COOKIE = {
  maxAge: DUREE_SESSION,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

/** Fusionne nos reglages avec ceux que Supabase demande pour un cookie donne. */
export function avecDuree<T extends Record<string, unknown> | undefined>(options: T) {
  return { ...OPTIONS_COOKIE, ...(options ?? {}), maxAge: DUREE_SESSION, path: "/" };
}
