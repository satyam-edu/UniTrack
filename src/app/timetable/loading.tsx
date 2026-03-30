import Skeleton from '@/components/Skeleton'
import BottomNav from '@/components/BottomNav'

export default function TimetableLoading() {
  return (
    <main className="flex-1 flex flex-col px-4 py-6 pb-24 max-w-lg mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Timetable</h1>
        <Skeleton className="h-9 w-20 rounded-xl" />
      </div>

      <div className="flex overflow-x-auto gap-2 pb-2 mb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 rounded-xl flex-[0_0_auto]" />
        ))}
      </div>

      <div className="space-y-4">
        <Skeleton className="h-24 w-full shadow-lg shadow-black/20" />
        <Skeleton className="h-24 w-full shadow-lg shadow-black/20" />
        <Skeleton className="h-24 w-full shadow-lg shadow-black/20" />
      </div>

      <BottomNav />
    </main>
  )
}
