import Skeleton from '@/components/Skeleton'
import BottomNav from '@/components/BottomNav'

export default function SubjectsLoading() {
  return (
    <main className="flex-1 flex flex-col px-4 py-6 pb-24 max-w-lg mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Subjects Dashboard</h1>
        <Skeleton className="h-9 w-20 rounded-xl" />
      </div>

      <div className="space-y-4">
        <Skeleton className="h-32 w-full shadow-lg shadow-black/20" />
        <Skeleton className="h-32 w-full shadow-lg shadow-black/20" />
        <Skeleton className="h-32 w-full shadow-lg shadow-black/20" />
        <Skeleton className="h-32 w-full shadow-lg shadow-black/20" />
      </div>

      <BottomNav />
    </main>
  )
}
