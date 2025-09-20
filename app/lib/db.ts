import { PrismaClient } from "@prisma/client";

// Create a global variable to store the Prisma client instance
const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

// Create a single instance of Prisma client to avoid connection pool exhaustion
export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: ["query"],
    });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Initialize database (create tables if they don't exist)
export async function initDatabase() {
    try {
        await prisma.$executeRaw`PRAGMA journal_mode=WAL;`;
        console.log("Database initialized successfully");
    } catch (error) {
        console.log("Database initialization error:", error);
    }
}
