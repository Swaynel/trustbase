import dotenv from 'dotenv'
import { defineConfig } from 'prisma/config'

dotenv.config()

export default defineConfig({
  schema: 'prisma/schema.prisma',
  experimental: {
    externalTables: true,
  },
  datasource: {
    url:
      process.env['DIRECT_URL'] ??
      process.env['SUPABASE_DB_URL'] ??
      process.env['DATABASE_URL'],
  },
  tables: {
    external: [
      'auth.users',
      'auth.audit_log_entries',
      'auth.custom_oauth_providers',
      'auth.flow_state',
      'auth.identities',
      'auth.instances',
      'auth.mfa_amr_claims',
      'auth.mfa_challenges',
      'auth.mfa_factors',
      'auth.oauth_authorizations',
      'auth.oauth_client_states',
      'auth.oauth_clients',
      'auth.oauth_consents',
      'auth.one_time_tokens',
      'auth.refresh_tokens',
      'auth.saml_providers',
      'auth.saml_relay_states',
      'auth.schema_migrations',
      'auth.sessions',
      'auth.sso_domains',
      'auth.sso_providers',
      'auth.webauthn_challenges',
      'auth.webauthn_credentials',
    ],
  },
  enums: {
    external: [
      'auth.aal_level',
      'auth.code_challenge_method',
      'auth.factor_status',
      'auth.factor_type',
      'auth.oauth_authorization_status',
      'auth.oauth_client_type',
      'auth.oauth_registration_type',
      'auth.oauth_response_type',
      'auth.one_time_token_type',
    ],
  },
  migrations: {
    initShadowDb: `
      CREATE EXTENSION IF NOT EXISTS vector;
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE IF NOT EXISTS auth.users (
        id UUID PRIMARY KEY
      );
    `,
  },
})
