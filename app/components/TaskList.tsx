import { getTasks, toggleTask, deleteTask } from '@/lib/actions'
import TaskItem from './TaskItem'

export default async function TaskList() {
    const tasks = await getTasks()

    if (tasks.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p className="text-lg">No tasks yet!</p>
                <p className="text-sm">Create your first task using the form above.</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                Tasks ({tasks.length})
            </h2>
            {tasks.map((task) => (
                <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={toggleTask}
                    onDelete={deleteTask}
                />
            ))}
        </div>
    )
}
