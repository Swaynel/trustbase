const DATABASE_URL_PREFIXES = ['postgres://', 'postgresql://']
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_SECRET_KEY =
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY

function getRequiredEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]
    if (value) {
      return value
    }
  }

  throw new Error(`Missing required environment variable. Expected one of: ${names.join(', ')}`)
}

function looksLikeDatabaseUrl(value: string) {
  return DATABASE_URL_PREFIXES.some((prefix) => value.startsWith(prefix))
}

export function getSupabaseUrl() {
  if (!SUPABASE_URL) {
    throw new Error('Missing required environment variable. Expected one of: NEXT_PUBLIC_SUPABASE_URL')
  }

  return SUPABASE_URL
}

export function getSupabasePublishableKey() {
  if (!SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      'Missing required environment variable. Expected one of: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  return SUPABASE_PUBLISHABLE_KEY
}

export function getSupabaseSecretKey() {
  const key = SUPABASE_SECRET_KEY ?? getRequiredEnv('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY')

  if (looksLikeDatabaseUrl(key)) {
    throw new Error(
      'Supabase admin access expects SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY (legacy), but received a Postgres connection URL. Move that value to SUPABASE_DB_URL instead.'
    )
  }

  return key
}
