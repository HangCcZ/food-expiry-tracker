'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AuthCallback() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check for error in URL params
        const params = new URLSearchParams(window.location.search)
        const error = params.get('error')
        const errorDescription = params.get('error_description')

        if (error) {
          console.error('Auth error:', error, errorDescription)
          router.push(`/auth/login?error=${error}`)
          return
        }

        // Exchange the code from URL hash for a session
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const accessToken = hashParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token')

        console.log('Callback - Has tokens:', {
          hasAccessToken: !!accessToken,
          hasRefreshToken: !!refreshToken
        })

        if (accessToken && refreshToken) {
          // Set the session
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            console.error('Session error:', sessionError)
            router.push('/auth/login?error=session_failed')
            return
          }

          if (data.session) {
            console.log('Session created successfully!')
            router.push('/')
            return
          }
        }

        // If no tokens in hash, try getting existing session
        const { data: { session }, error: getSessionError } = await supabase.auth.getSession()

        if (getSessionError) {
          console.error('Get session error:', getSessionError)
          router.push('/auth/login?error=callback_failed')
          return
        }

        if (session) {
          console.log('Existing session found!')
          router.push('/')
        } else {
          console.log('No session found, redirecting to login')
          router.push('/auth/login')
        }
      } catch (error) {
        console.error('Unexpected error in auth callback:', error)
        router.push('/auth/login')
      }
    }

    handleCallback()
  }, [router, supabase])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
      <div className="text-center">
        {/* Loading Spinner */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Signing you in...</h2>
        <p className="mt-2 text-sm text-gray-600">Please wait a moment</p>
      </div>
    </div>
  )
}
