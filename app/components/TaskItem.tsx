'use client'

import { useState, useTransition } from 'react'
import { Task } from '@/lib/actions'

interface TaskItemProps {
    task: Task
    onToggle: (id: number, completed: boolean) => Promise<void>
    onDelete: (id: number) => Promise<void>
}

export default function TaskItem({ task, onToggle, onDelete }: TaskItemProps) {
    const [isPending, startTransition] = useTransition()
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    const handleToggle = () => {
        startTransition(async () => {
            try {
                await onToggle(task.id, !task.completed)
            } catch (error) {
                console.error('Failed to toggle task:', error)
            }
        })
    }

    const handleDelete = () => {
        startTransition(async () => {
            try {
                await onDelete(task.id)
                setShowDeleteConfirm(false)
            } catch (error) {
                console.error('Failed to delete task:', error)
            }
        })
    }

    return (
        <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                    <button
                        onClick={handleToggle}
                        disabled={isPending}
                        className="mt-1 w-5 h-5 rounded border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center hover:border-blue-500 transition-colors"
                        style={{
                            backgroundColor: task.completed ? '#3b82f6' : 'transparent',
                            borderColor: task.completed ? '#3b82f6' : undefined
                        }}
                    >
                        {task.completed && (
                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>

                    <div className="flex-1">
                        <h3 className={`font-medium ${task.completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                            {task.title}
                        </h3>
                        {task.description && (
                            <p className={`mt-1 text-sm ${task.completed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-300'}`}>
                                {task.description}
                            </p>
                        )}
                        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                            Created: {new Date(task.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <div className="flex space-x-2 ml-4">
                    {!showDeleteConfirm ? (
                        <button
                            onClick={() => setShowDeleteConfirm(true)}
                            disabled={isPending}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 p-1"
                            title="Delete task"
                        >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        </button>
                    ) : (
                        <div className="flex space-x-1">
                            <button
                                onClick={handleDelete}
                                disabled={isPending}
                                className="text-red-600 hover:text-red-800 dark:text-red-400 text-xs px-2 py-1 border border-red-600 rounded"
                            >
                                {isPending ? '...' : 'Yes'}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                disabled={isPending}
                                className="text-gray-600 hover:text-gray-800 dark:text-gray-400 text-xs px-2 py-1 border border-gray-600 rounded"
                            >
                                No
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
