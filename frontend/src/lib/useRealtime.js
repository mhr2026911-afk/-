import { useEffect } from 'react'
import { useAuth } from './auth'
import { connectSocket, onSocket } from './socket'
import { ping, vibrate } from './feedback'

/** Opens the realtime connection and reacts to incoming events according to
 *  the user's notification settings. */
export function useRealtime() {
  const { user, settings } = useAuth()

  useEffect(() => {
    if (user) connectSocket()
  }, [user])

  useEffect(() => {
    if (!user) return undefined
    return onSocket((event) => {
      if (event.type === 'message:new' && settings?.notify_messages) {
        if (settings.notify_sound) ping('message')
        if (settings.notify_vibration) vibrate(40)
      }
      if (event.type === 'call:invite' && settings?.notify_calls) {
        if (settings.notify_sound) ping('call')
        if (settings.notify_vibration) vibrate([160, 90, 160])
      }
    })
  }, [user, settings])
}
