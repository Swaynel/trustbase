import { loadEnvFile } from 'node:process'
import { defineConfig } from 'prisma/config'

loadEnvFile()

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env['SUPABASE_DB_URL'],
  },
})
