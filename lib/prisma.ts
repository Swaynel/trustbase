import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.SUPABASE_DB_URL

if (!connectionString) {
  throw new Error('Missing required environment variable: SUPABASE_DB_URL')
}

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient
}

const adapter = new PrismaPg(connectionString)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
