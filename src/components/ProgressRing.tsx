'use client'

import { useEffect, useState } from 'react'

interface ProgressRingProps {
  percentage: number
  target?: number
  size?: number | string
  strokeWidth?: number
  className?: string
}

export default function ProgressRing({
  percentage,
  target = 75,
  size = 112,
  strokeWidth = 8,
  className = '',
}: ProgressRingProps) {
  const [offset, setOffset] = useState(0)
  const isHealthy = percentage >= target

  // Calculate actual dimensions if size is passed as string '100%' it will cause issues with math
  const numericSize = typeof size === 'number' ? size : 112
  const safePercentage = isNaN(percentage) || percentage < 0 ? 0 : percentage > 100 ? 100 : percentage

  const radius = numericSize / 2 - strokeWidth
  const circumference = radius * 2 * Math.PI

  useEffect(() => {
    // Trigger CSS transition
    const timeout = setTimeout(() => {
      const progressOffset = circumference - (safePercentage / 100) * circumference
      setOffset(progressOffset)
    }, 100)
    return () => clearTimeout(timeout)
  }, [safePercentage, circumference])

  // Initialize offset to full circumference (0% graphic) so it animates up
  const initialOffset = circumference

  return (
    <div
      className={`relative inline-flex items-center justify-center flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg className="w-full h-full transform -rotate-90" viewBox={`0 0 ${numericSize} ${numericSize}`}>
        <circle
          cx={numericSize / 2}
          cy={numericSize / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-card-border"
        />
        <circle
          cx={numericSize / 2}
          cy={numericSize / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset || initialOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
          className={
            isNaN(percentage) || percentage === 0 ? 'text-text-muted opacity-20' : isHealthy ? 'text-success' : 'text-danger'
          }
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold relative flex items-start leading-none" style={{ fontSize: numericSize * 0.22 }}>
          {isNaN(percentage) ? '--' : Math.round(safePercentage)}
          <span className="text-[0.5em] ml-[1px]">%</span>
        </span>
      </div>
    </div>
  )
}
