'use client'

import { useEffect } from 'react'

export default function PWAProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
      // Defer SW registration
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => console.log('SW Registration successful', reg.scope))
          .catch((err) => console.log('SW Registration failed', err))
      })
    } else if ('serviceWorker' in navigator && window.location.hostname === 'localhost') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((reg) => console.log('SW Registration successful (localhost)', reg.scope))
          .catch((err) => console.log('SW Registration failed (localhost)', err))
      })
    }
  }, [])

  return <>{children}</>
}
