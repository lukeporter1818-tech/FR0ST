import { createClient } from '@supabase/supabase-js'

// Browser-side Supabase client — used only for Realtime (chat broadcast).
// Auth is handled by NextAuth; this client uses the anon/publishable key.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
