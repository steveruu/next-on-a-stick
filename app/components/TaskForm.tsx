'use client'

import { createTask } from '@/lib/actions'
import { useState, useTransition } from 'react'

export default function TaskForm() {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [isPending, startTransition] = useTransition()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!title.trim()) return

        startTransition(async () => {
            try {
                await createTask(title.trim(), description.trim() || undefined)
                setTitle('')
                setDescription('')
            } catch (error) {
                console.error('Failed to create task:', error)
            }
        })
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add New Task</h2>

            <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Title *
                </label>
                <input
                    type="text"
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter task title..."
                    required
                    disabled={isPending}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
            </div>

            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                </label>
                <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter task description..."
                    rows={3}
                    disabled={isPending}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                />
            </div>

            <button
                type="submit"
                disabled={isPending || !title.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200"
            >
                {isPending ? 'Adding...' : 'Add Task'}
            </button>
        </form>
    )
}
