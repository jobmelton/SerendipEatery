'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/pwa'

export function PWAInit() {
  useEffect(() => {
    registerServiceWorker()
  }, [])
  return null
}
