import Skeleton from '@/components/Skeleton'
import BottomNav from '@/components/BottomNav'

export default function HomeLoading() {
  return (
    <main className="flex-1 flex flex-col px-4 py-6 pb-24 max-w-lg mx-auto w-full">
      {/* Header Stats */}
      <Skeleton className="h-40 w-full mb-8 shadow-lg shadow-black/20" />

      {/* Calendar Grid */}
      <div className="mb-8">
        <Skeleton className="h-6 w-32 mb-4" />
        <div className="grid grid-cols-7 grid-rows-2 gap-1.5">
          {Array.from({ length: 14 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      </div>

      {/* Roster list */}
      <div>
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="space-y-4">
          <Skeleton className="h-28 w-full shadow-lg shadow-black/20" />
          <Skeleton className="h-28 w-full shadow-lg shadow-black/20" />
          <Skeleton className="h-28 w-full shadow-lg shadow-black/20" />
        </div>
      </div>

      <BottomNav />
    </main>
  )
}
