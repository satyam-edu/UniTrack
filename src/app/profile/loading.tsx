import Skeleton from '@/components/Skeleton'
import BottomNav from '@/components/BottomNav'

export default function ProfileLoading() {
  return (
    <main className="flex-1 flex flex-col px-4 py-6 pb-24 max-w-lg mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
      </div>

      {/* Avatar block */}
      <Skeleton className="h-56 w-full rounded-2xl mb-6 shadow-lg shadow-black/20" />

      {/* Settings Block */}
      <Skeleton className="h-48 w-full rounded-2xl mb-6 shadow-lg shadow-black/20" />

      {/* Details Blocks */}
      <Skeleton className="h-72 w-full rounded-2xl mb-8 shadow-lg shadow-black/20" />

      {/* Logout button */}
      <Skeleton className="h-14 w-full rounded-xl" />

      <BottomNav />
    </main>
  )
}
