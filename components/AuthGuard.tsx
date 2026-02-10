'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'

// Set to true to bypass authentication for development
const BYPASS_AUTH = false

interface AuthGuardProps {
  children: React.ReactNode
}

/**
 * Wrapper component that redirects to login if user is not authenticated
 */
export default function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (BYPASS_AUTH) return

    if (!loading && !user) {
      router.push('/auth/login')
    }
  }, [user, loading, router])

  // Bypass authentication if flag is set
  if (BYPASS_AUTH) {
    return <>{children}</>
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Don't render children if not authenticated
  if (!user) {
    return null
  }

  return <>{children}</>
}
