import AuthGuard from '@/components/AuthGuard'
import Dashboard from '@/components/Dashboard'
import PushNotificationSetup from '@/components/PushNotificationSetup'

export default function Home() {
  return (
    <AuthGuard>
      <div className="pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
          <PushNotificationSetup />
        </div>
        <Dashboard />
      </div>
    </AuthGuard>
  )
}
