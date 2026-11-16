import { PrismaClient } from '@prisma/client'

/** Shared Prisma client for new modules (activities, routes). index.ts keeps its own instance (see NOTES.md). */
export const prisma = new PrismaClient()
