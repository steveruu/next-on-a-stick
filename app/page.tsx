import { Suspense } from 'react'
import TaskForm from './components/TaskForm'
import TaskList from './components/TaskList'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Task Manager
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Demo CRUD app with Prisma & SQLite running in Docker
          </p>
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
            Database stored in: /data/database.db
          </p>
        </header>

        <div className="space-y-8">
          {/* Task Creation Form */}
          <TaskForm />

          {/* Task List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <Suspense
              fallback={
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600 dark:text-gray-400">Loading tasks...</p>
                </div>
              }
            >
              <TaskList />
            </Suspense>
          </div>
        </div>

        <footer className="text-center mt-12 text-sm text-gray-500 dark:text-gray-400">
          <p>Built with Next.js 15, Prisma, SQLite & Docker</p>
          <p className="mt-1">Data persists in the /data directory</p>
        </footer>
      </div>
    </div>
  )
}
