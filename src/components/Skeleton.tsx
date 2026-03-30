export default function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-card-border/70 rounded-2xl ${className}`} />
  )
}
