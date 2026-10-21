import { PrismaClient } from '@prisma/client';

// PrismaClient singleton instance
let prisma: PrismaClient;

/**
 * Get Prisma Client singleton instance.
 * On Lambda, each warm instance reuses the same client.
 * connection_limit=1 prevents exhausting DB connections across concurrent invocations.
 */
export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;
    const datasourceUrl = isLambda
      ? appendPoolParams(process.env.DATABASE_URL || process.env.URL || '')
      : undefined;

    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
      ...(datasourceUrl && {
        datasources: { db: { url: datasourceUrl } },
      }),
    });
  }
  return prisma;
}

/**
 * Appends Lambda-safe connection pool params to a PostgreSQL URL.
 * connection_limit=1  — one connection per Lambda container
 * pool_timeout=10     — fail fast if pool is exhausted
 * connect_timeout=10  — don't hang on cold DB connections
 */
function appendPoolParams(url: string): string {
  if (!url) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}connection_limit=1&pool_timeout=10&connect_timeout=10`;
}

/**
 * Disconnect from database
 * Should be called when shutting down the application
 */
export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
}

export default getPrismaClient;
