import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import type { PoolConfig } from 'pg'

const connectionString =
  process.env.DATABASE_URL ??
  process.env.SUPABASE_DB_URL

if (!connectionString) {
  throw new Error('Missing required environment variable: DATABASE_URL or SUPABASE_DB_URL')
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
}

const poolConfig: PoolConfig & { family: 4 } = {
  connectionString,
  family: 4,
  ssl: { rejectUnauthorized: false },
}

const adapter = new PrismaPg(poolConfig)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
