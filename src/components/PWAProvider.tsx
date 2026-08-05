'use client'

import { useEffect } from 'react'

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost'
    if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || isLocalhost)) {
      // Defer SW registration
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(() => {})
      })
    }
  }, [])

  return <>{children}</>
}
