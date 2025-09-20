"use server";

import { prisma, initDatabase } from "./db";
import { revalidatePath } from "next/cache";

export type Task = {
    id: number;
    title: string;
    description: string | null;
    completed: boolean;
    createdAt: Date;
    updatedAt: Date;
};

// Initialize database and create tables if needed
export async function ensureDatabase() {
    try {
        await initDatabase();
        // Try to create tables by running a simple migration
        await prisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS Task (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        completed BOOLEAN DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;
    } catch (error) {
        console.log("Database setup error:", error);
    }
}

// Get all tasks
export async function getTasks(): Promise<Task[]> {
    try {
        await ensureDatabase();
        const tasks = await prisma.task.findMany({
            orderBy: { createdAt: "desc" },
        });
        return tasks;
    } catch (error) {
        console.error("Error fetching tasks:", error);
        return [];
    }
}

// Create a new task
export async function createTask(title: string, description?: string) {
    try {
        await ensureDatabase();
        await prisma.task.create({
            data: {
                title,
                description: description || null,
            },
        });
        revalidatePath("/");
    } catch (error) {
        console.error("Error creating task:", error);
        throw new Error("Failed to create task");
    }
}

// Update task completion status
export async function toggleTask(id: number, completed: boolean) {
    try {
        await prisma.task.update({
            where: { id },
            data: {
                completed,
                updatedAt: new Date(),
            },
        });
        revalidatePath("/");
    } catch (error) {
        console.error("Error updating task:", error);
        throw new Error("Failed to update task");
    }
}

// Delete a task
export async function deleteTask(id: number) {
    try {
        await prisma.task.delete({
            where: { id },
        });
        revalidatePath("/");
    } catch (error) {
        console.error("Error deleting task:", error);
        throw new Error("Failed to delete task");
    }
}

// Update task title and description
export async function updateTask(
    id: number,
    title: string,
    description?: string
) {
    try {
        await prisma.task.update({
            where: { id },
            data: {
                title,
                description: description || null,
                updatedAt: new Date(),
            },
        });
        revalidatePath("/");
    } catch (error) {
        console.error("Error updating task:", error);
        throw new Error("Failed to update task");
    }
}
