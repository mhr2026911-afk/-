import { useEffect, useRef, useState } from 'react'
import Icon from './Icons'
import { mediaUrl } from '../lib/api'
import { formatBytes, formatDuration } from '../lib/format'

function VoiceNote({ mediaId, duration = 0, own }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(duration)

  useEffect(() => {
    setPlaying(false)
    setProgress(0)
    setTotal(duration)
  }, [mediaId, duration])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      audio.play().catch(() => setPlaying(false))
    }
  }

  const seek = (event) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    const rect = event.currentTarget.getBoundingClientRect()
    const ratio = (rect.right - event.clientX) / rect.width
    audio.currentTime = Math.min(Math.max(ratio, 0), 1) * audio.duration
  }

  const percent = total > 0 ? Math.min(100, (progress / total) * 100) : 0

  return (
    <div
      className={`flex min-w-[190px] items-center gap-3 rounded-xl px-1 py-0.5 ${
        own ? 'text-brand-dark' : 'text-ink'
      }`}
    >
      <button
        type="button"
        onClick={toggle}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          own ? 'bg-white/70 text-brand' : 'bg-brand-soft text-brand'
        }`}
        aria-label={playing ? 'إيقاف الرسالة الصوتية' : 'تشغيل الرسالة الصوتية'}
      >
        <Icon name={playing ? 'pause' : 'play'} size={16} filled />
      </button>
      <div className="flex-1">
        <div
          className="flex h-7 cursor-pointer items-center gap-0.5"
          onClick={seek}
          role="presentation"
        >
          {Array.from({ length: 26 }).map((_, index) => {
            const active = (index / 26) * 100 <= percent
            const heights = [8, 14, 20, 12, 18, 10, 22, 16, 9, 15, 21, 13]
            return (
              <span
                key={index}
                className={`w-[3px] rounded-full ${
                  active ? (own ? 'bg-brand' : 'bg-brand') : 'bg-ink/15'
                }`}
                style={{ height: `${heights[index % heights.length]}px` }}
              />
            )
          })}
        </div>
        <p className="mt-0.5 text-[11px] font-medium text-muted">
          {formatDuration(playing || progress ? progress : total)}
        </p>
      </div>
      <audio
        ref={audioRef}
        src={mediaUrl(mediaId)}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setProgress(0)
        }}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration
          if (Number.isFinite(value) && value > 0) setTotal(value)
        }}
        onTimeUpdate={(event) => setProgress(event.currentTarget.currentTime)}
        hidden
      />
    </div>
  )
}

export default function Attachment({ message, own = false }) {
  const meta = message.meta || {}
  const url = mediaUrl(message.media_id)

  if (message.kind === 'image') {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
        <img
          src={url}
          alt={meta.filename || 'صورة مرسلة'}
          className="max-h-72 w-full object-cover"
          loading="lazy"
        />
      </a>
    )
  }

  if (message.kind === 'video') {
    return (
      <video
        src={url}
        controls
        playsInline
        className="max-h-72 w-full rounded-xl bg-black/90"
      />
    )
  }

  if (message.kind === 'audio') {
    return <VoiceNote mediaId={message.media_id} duration={meta.duration || 0} own={own} />
  }

  if (message.kind === 'location') {
    const lat = meta.lat
    const lng = meta.lng
    const maps = lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}` : null
    return (
      <a
        href={maps || '#'}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-3 rounded-xl bg-white/70 p-2"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Icon name="pin" size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-bold text-ink">الموقع الحالي</span>
          <span className="block truncate text-[11px] text-muted">
            {lat != null ? `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}` : 'موقع مشترك'}
          </span>
        </span>
        <Icon name="chevron" size={16} className="text-muted" />
      </a>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      download={meta.filename || undefined}
      className="flex items-center gap-3 rounded-xl bg-white/70 p-2"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon name="file" size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-bold text-ink">
          {meta.filename || 'ملف مرفق'}
        </span>
        <span className="block text-[11px] text-muted">{formatBytes(meta.size || 0)}</span>
      </span>
      <Icon name="download" size={17} className="text-muted" />
    </a>
  )
}
