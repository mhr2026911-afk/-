import { useCallback, useEffect, useRef, useState } from 'react'
import { CallContext } from './callContext'
import { api } from './api'
import { useAuth } from './auth'
import { onSocket, socketSend } from './socket'
import CallOverlay from '../components/CallOverlay'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

export function CallProvider({ children }) {
  const { user } = useAuth()
  const [session, setSession] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [muted, setMuted] = useState(false)
  const [cameraOn, setCameraOn] = useState(true)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0)

  const sessionRef = useRef(null)
  const pcRef = useRef(null)
  const localRef = useRef(null)
  const pendingIce = useRef([])
  const connectedAt = useRef(null)
  const finishTimer = useRef(null)
  const closing = useRef(false)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    if (session?.status !== 'connected') {
      setElapsed(0)
      return undefined
    }
    const startedAt = connectedAt.current || Date.now()
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [session?.status])

  const teardown = useCallback(() => {
    if (localRef.current) {
      localRef.current.getTracks().forEach((track) => track.stop())
      localRef.current = null
    }
    if (pcRef.current) {
      try {
        pcRef.current.close()
      } catch {
        /* already closed */
      }
      pcRef.current = null
    }
    pendingIce.current = []
    connectedAt.current = null
    setLocalStream(null)
    setRemoteStream(null)
    setMuted(false)
    setCameraOn(true)
  }, [])

  useEffect(() => {
    if (!user) {
      teardown()
      setSession(null)
    }
  }, [user, teardown])

  const finish = useCallback(
    (status) => {
      if (closing.current) return
      closing.current = true
      setSession((current) => (current ? { ...current, status } : current))
      finishTimer.current = setTimeout(() => {
        teardown()
        setSession(null)
        closing.current = false
        setError('')
      }, 1400)
    },
    [teardown],
  )

  useEffect(
    () => () => {
      if (finishTimer.current) clearTimeout(finishTimer.current)
      teardown()
    },
    [teardown],
  )

  const ensurePeer = useCallback((callId) => {
    if (pcRef.current) return pcRef.current
    if (typeof RTCPeerConnection === 'undefined') {
      setError('المتصفح لا يدعم المكالمات الصوتية والمرئية')
      return null
    }
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketSend({ type: 'call:ice', call_id: callId, candidate: event.candidate })
      }
    }
    pc.ontrack = (event) => setRemoteStream(event.streams[0])
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') {
        connectedAt.current = connectedAt.current || Date.now()
        setSession((current) => (current ? { ...current, status: 'connected' } : current))
      }
    }
    pcRef.current = pc
    return pc
  }, [])

  const openMedia = useCallback(async (kind) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('تعذّر الوصول إلى الميكروفون أو الكاميرا على هذا الجهاز')
      return null
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: kind === 'video',
      })
      localRef.current = stream
      setLocalStream(stream)
      return stream
    } catch {
      setError('تعذّر الوصول إلى الميكروفون أو الكاميرا، تحقّق من أذونات الجهاز')
      return null
    }
  }, [])

  const startCall = useCallback(
    async (peer, kind = 'audio') => {
      if (!peer?.id || sessionRef.current) return null
      setError('')
      try {
        const data = await api.post('/api/calls', { callee_id: peer.id, kind })
        connectedAt.current = null
        setSession({
          call: data.call,
          peer: data.peer,
          direction: 'outgoing',
          kind,
          status: 'ringing',
        })
        const stream = await openMedia(kind)
        const pc = stream ? ensurePeer(data.call.id) : null
        if (pc && stream) {
          stream.getTracks().forEach((track) => pc.addTrack(track, stream))
        }
        return data
      } catch (err) {
        setError(err.message)
        setTimeout(() => setError(''), 3500)
        return null
      }
    },
    [ensurePeer, openMedia],
  )

  const acceptCall = useCallback(async () => {
    const current = sessionRef.current
    if (!current || current.direction !== 'incoming') return
    setError('')
    setSession({ ...current, status: 'connecting' })
    socketSend({ type: 'call:accept', call_id: current.call.id })
    const stream = await openMedia(current.kind)
    const pc = stream ? ensurePeer(current.call.id) : null
    if (pc && stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))
    }
  }, [ensurePeer, openMedia])

  const declineCall = useCallback(() => {
    const current = sessionRef.current
    if (!current) return
    socketSend({ type: 'call:decline', call_id: current.call.id })
    finish('declined')
  }, [finish])

  const endCall = useCallback(() => {
    const current = sessionRef.current
    if (!current) return
    const duration = connectedAt.current
      ? Math.floor((Date.now() - connectedAt.current) / 1000)
      : 0
    const status = current.status === 'connected' ? 'ended' : 'missed'
    socketSend({ type: 'call:end', call_id: current.call.id, status, duration })
    finish(status === 'ended' ? 'ended' : 'missed')
  }, [finish])

  const toggleMute = useCallback(() => {
    const stream = localRef.current
    if (!stream) return
    const next = !muted
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !next
    })
    setMuted(next)
  }, [muted])

  const toggleCamera = useCallback(() => {
    const stream = localRef.current
    if (!stream) return
    const next = !cameraOn
    stream.getVideoTracks().forEach((track) => {
      track.enabled = next
    })
    setCameraOn(next)
  }, [cameraOn])

  useEffect(() => {
    if (!user) return undefined
    return onSocket(async (event) => {
      const type = event?.type || ''
      if (!type.startsWith('call:')) return
      const current = sessionRef.current

      if (type === 'call:invite') {
        if (current) {
          socketSend({ type: 'call:decline', call_id: event.call.id })
          return
        }
        setError('')
        closing.current = false
        setSession({
          call: event.call,
          peer: event.peer,
          direction: 'incoming',
          kind: event.call.kind,
          status: 'ringing',
        })
        return
      }

      if (!current || event.call_id !== current.call.id) return
      const callId = current.call.id

      try {
        if (type === 'call:accept') {
          setSession({ ...current, status: 'connecting' })
          const pc = pcRef.current
          if (pc) {
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)
            socketSend({ type: 'call:offer', call_id: callId, sdp: offer })
          }
        } else if (type === 'call:offer') {
          const pc = ensurePeer(callId)
          if (!pc) return
          await pc.setRemoteDescription(new RTCSessionDescription(event.sdp))
          for (const candidate of pendingIce.current) {
            try {
              await pc.addIceCandidate(candidate)
            } catch {
              /* stale candidate */
            }
          }
          pendingIce.current = []
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          socketSend({ type: 'call:answer', call_id: callId, sdp: answer })
        } else if (type === 'call:answer') {
          const pc = pcRef.current
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(event.sdp))
        } else if (type === 'call:ice') {
          const pc = pcRef.current
          if (!pc) return
          if (!pc.remoteDescription) {
            pendingIce.current.push(event.candidate)
          } else {
            try {
              await pc.addIceCandidate(event.candidate)
            } catch {
              /* stale candidate */
            }
          }
        } else if (type === 'call:decline') {
          finish('declined')
        } else if (type === 'call:end') {
          finish(current.status === 'connected' ? 'ended' : 'missed')
        }
      } catch {
        setError('تعذّر إكمال إعداد المكالمة')
      }
    })
  }, [ensurePeer, finish, user])

  const value = {
    session,
    localStream,
    remoteStream,
    muted,
    cameraOn,
    error,
    elapsed,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
  }

  return (
    <CallContext.Provider value={value}>
      {children}
      <CallOverlay />
    </CallContext.Provider>
  )
}
