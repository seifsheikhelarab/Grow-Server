import { PrismaClient } from '@prisma/client';
import logger from './utils/logger';

/**
 * Singleton Prisma Client
 * Ensures only one connection to the database
 */
let prisma: PrismaClient<{
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'error' },
    { emit: 'stdout', level: 'warn' },
  ];
}>;

declare global {
  var prismaInstance: typeof prisma | undefined;
}

if (!global.prismaInstance) {
  prisma = new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'stdout', level: 'error' },
      { emit: 'stdout', level: 'warn' },
    ],
  });

  // Log database queries in development
  if (process.env.NODE_ENV === 'development') {
    prisma.$on('query', (e) => {
      logger.debug(`Query: ${e.query}`);
      logger.debug(`Duration: ${e.duration}ms`);
    });
  }

  global.prismaInstance = prisma;
} else {
  prisma = global.prismaInstance;
}

export default prisma;
