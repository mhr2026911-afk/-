import { useEffect, useRef } from 'react'
import Icon from './Icons'
import Avatar from './Avatar'
import { useCall } from '../lib/callContext'
import { formatDuration } from '../lib/format'

function statusLabel(session, elapsed) {
  if (!session) return ''
  if (session.status === 'connected') return formatDuration(elapsed)
  if (session.status === 'ringing') {
    return session.direction === 'incoming' ? 'مكالمة واردة' : 'جارٍ الاتصال…'
  }
  if (session.status === 'connecting') return 'جارٍ الربط…'
  if (session.status === 'declined') return 'تم رفض المكالمة'
  if (session.status === 'missed') return 'مكالمة فائتة'
  return 'انتهت المكالمة'
}

export default function CallOverlay() {
  const {
    session,
    localStream,
    remoteStream,
    muted,
    cameraOn,
    error,
    elapsed,
    acceptCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useCall()

  const localVideo = useRef(null)
  const remoteVideo = useRef(null)
  const remoteAudio = useRef(null)

  useEffect(() => {
    if (localVideo.current) localVideo.current.srcObject = localStream || null
  }, [localStream, session])

  useEffect(() => {
    if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream || null
    if (remoteAudio.current) remoteAudio.current.srcObject = remoteStream || null
  }, [remoteStream])

  if (!session) {
    if (!error) return null
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4">
        <p className="rounded-full bg-brand-deep px-4 py-2 text-[12px] font-medium text-white shadow-float">
          {error}
        </p>
      </div>
    )
  }

  const incoming = session.direction === 'incoming' && session.status === 'ringing'
  const isVideo = session.kind === 'video'
  const peerName = session.peer?.name || session.peer?.phone || 'مستخدم مرسال'

  return (
    <div className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-gradient-to-b from-brand-deep via-[#0a3a2e] to-[#061f19] text-white">
      {isVideo ? (
        <video
          ref={remoteVideo}
          autoPlay
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <audio ref={remoteAudio} autoPlay />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-transparent to-black/70" />

      <div className="relative z-10 flex items-start justify-between px-5 pt-8">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-white/70">
            {session.kind === 'video' ? 'مكالمة مرئية' : 'مكالمة صوتية'}
          </p>
          <h2 className="mt-1 text-xl font-extrabold">{peerName}</h2>
          <p className="mt-1 text-[13px] text-white/80">{statusLabel(session, elapsed)}</p>
          {error ? (
            <p className="mt-2 max-w-[240px] rounded-xl bg-white/10 px-3 py-2 text-[11.5px] leading-5 text-white/90">
              {error}
            </p>
          ) : null}
        </div>
        {isVideo && localStream ? (
          <video
            ref={localVideo}
            autoPlay
            muted
            playsInline
            className="h-32 w-24 rounded-2xl border border-white/30 object-cover shadow-float"
          />
        ) : null}
      </div>

      {!isVideo ? (
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-5">
          <span className="relative flex items-center justify-center">
            {session.status !== 'connected' && session.status !== 'ended' ? (
              <span className="absolute h-28 w-28 rounded-full bg-white/15 animate-ripple" />
            ) : null}
            <Avatar
              user={session.peer}
              size="xl"
              className="relative ring-4 ring-white/25"
            />
          </span>
          <div className="text-center">
            <p className="text-lg font-bold">{peerName}</p>
            <p className="mt-1 text-[13px] text-white/75" dir="ltr">
              {session.peer?.phone || ''}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1" />
      )}

      <div className="relative z-10 px-6 pb-10">
        {incoming ? (
          <div className="flex items-center justify-around">
            <button
              type="button"
              onClick={declineCall}
              className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-full bg-rose-500 text-white shadow-float active:scale-95"
              aria-label="رفض المكالمة"
            >
              <Icon name="close" size={24} />
            </button>
            <button
              type="button"
              onClick={acceptCall}
              className="flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-full bg-emerald-500 text-white shadow-float active:scale-95"
              aria-label="قبول المكالمة"
            >
              <Icon name="phone" size={24} />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={toggleMute}
              className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/20 ${
                muted ? 'bg-white text-brand-deep' : 'bg-white/10 text-white'
              }`}
              aria-label={muted ? 'إلغاء كتم الصوت' : 'كتم الصوت'}
            >
              <Icon name={muted ? 'mute' : 'mic'} size={20} />
            </button>
            {isVideo ? (
              <button
                type="button"
                onClick={toggleCamera}
                className={`flex h-12 w-12 items-center justify-center rounded-full border border-white/20 ${
                  cameraOn ? 'bg-white/10 text-white' : 'bg-white text-brand-deep'
                }`}
                aria-label={cameraOn ? 'إيقاف الكاميرا' : 'تشغيل الكاميرا'}
              >
                <Icon name="cameraFlip" size={20} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={endCall}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-white shadow-float active:scale-95"
              aria-label="إنهاء المكالمة"
            >
              <Icon name="phone" size={24} className="rotate-[135deg]" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
