import { useEffect, useRef, useState } from 'react'
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import BottomNav from './components/BottomNav'
import LockScreen from './components/LockScreen'
import Brand from './components/Brand'
import AuthPage from './pages/AuthPage'
import CallsPage from './pages/CallsPage'
import ChatRoomPage from './pages/ChatRoomPage'
import ChatsPage from './pages/ChatsPage'
import ContactsPage from './pages/ContactsPage'
import GroupInfoPage from './pages/GroupInfoPage'
import GroupsPage from './pages/GroupsPage'
import NotificationsPage from './pages/NotificationsPage'
import PrivacyPage from './pages/PrivacyPage'
import ProfilePage from './pages/ProfilePage'
import SettingsPage from './pages/SettingsPage'
import StoragePage from './pages/StoragePage'
import StoriesPage from './pages/StoriesPage'
import { AuthProvider, useAuth } from './lib/auth'
import { CallProvider } from './lib/CallProvider'
import { pinIsSet } from './lib/pin'
import { useRealtime } from './lib/useRealtime'

function Splash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-canvas">
      <Brand size="lg" withName={false} />
      <p className="text-[13px] font-bold text-ink">مرسال</p>
      <span className="h-1 w-24 overflow-hidden rounded-full bg-line">
        <span className="block h-full w-1/2 animate-pulse rounded-full bg-brand" />
      </span>
    </div>
  )
}

function Shell() {
  const { loading, user, settings } = useAuth()
  const location = useLocation()
  const [unlocked, setUnlocked] = useState(true)
  const initialised = useRef(false)
  useRealtime()

  useEffect(() => {
    if (!user) {
      initialised.current = false
      setUnlocked(true)
      return
    }
    if (!initialised.current) {
      initialised.current = true
      setUnlocked(!(settings?.app_lock && pinIsSet()))
    }
  }, [user, settings])

  if (loading) return <Splash />
  if (!user) return <AuthPage />

  if (settings?.app_lock && pinIsSet() && !unlocked) {
    return <LockScreen onUnlock={() => setUnlocked(true)} />
  }

  const isChatRoom = /^\/chats\/[^/]+$/.test(location.pathname)

  return (
    <div className="app-shell">
      <main
        className={
          isChatRoom
            ? 'flex min-h-0 flex-1 flex-col overflow-hidden'
            : 'min-h-0 flex-1 overflow-y-auto no-scrollbar'
        }
      >
        <Routes>
          <Route path="/" element={<Navigate to="/chats" replace />} />
          <Route path="/chats" element={<ChatsPage />} />
          <Route path="/chats/:id" element={<ChatRoomPage />} />
          <Route path="/stories" element={<StoriesPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:id" element={<GroupInfoPage />} />
          <Route path="/calls" element={<CallsPage />} />
          <Route path="/contacts" element={<ContactsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/profile" element={<ProfilePage />} />
          <Route path="/settings/privacy" element={<PrivacyPage />} />
          <Route path="/settings/notifications" element={<NotificationsPage />} />
          <Route path="/settings/storage" element={<StoragePage />} />
          <Route path="*" element={<Navigate to="/chats" replace />} />
        </Routes>
      </main>
      {isChatRoom ? null : <BottomNav />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CallProvider>
          <Shell />
        </CallProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
