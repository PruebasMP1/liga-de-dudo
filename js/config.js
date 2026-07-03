// ============================================================================
//  CONFIG DE LA NUBE (Supabase) — se rellena una sola vez.
//
//  Estos valores NO son secretos: la "anon key" está pensada para vivir en el
//  navegador (es pública). Lo que protege los datos son las políticas (RLS) de
//  la base. NUNCA pongas aquí la "service_role key" (esa sí es secreta).
//
//  Mientras estén vacíos, la app funciona 100% local (como antes). Al llenarlos
//  y volver a publicar, los resultados se comparten entre todos.
// ============================================================================

export const SUPABASE_URL = "";       // ej: https://abcdefgh.supabase.co
export const SUPABASE_ANON_KEY = "";  // la clave "anon public"

// Identificador de la liga (una sola fila compartida por todo el grupo).
export const LIGA_ID = "principal";
