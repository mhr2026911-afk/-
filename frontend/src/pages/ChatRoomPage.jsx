import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Attachment from '../components/Attachment'
import Avatar from '../components/Avatar'
import Icon from '../components/Icons'
import MessageStatus from '../components/MessageStatus'
import Sheet from '../components/Sheet'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useCall } from '../lib/callContext'
import { formatClock, formatDay, formatDuration, formatLastSeen } from '../lib/format'
import { onSocket, socketSend } from '../lib/socket'

export default function ChatRoomPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { startCall } = useCall()
  const navigate = useNavigate()

  const [meta, setMeta] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [typing, setTyping] = useState(false)
  const [sheet, setSheet] = useState(null)
  const [peerInfo, setPeerInfo] = useState(null)
  const [recording, setRecording] = useState(null)
  const [sending, setSending] = useState(false)

  const scrollRef = useRef(null)
  const mediaInput = useRef(null)
  const fileInput = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const recordTimer = useRef(null)
  const typingTimer = useRef(null)
  const lastTypingAt = useRef(0)

  const chat = meta?.conversation
  const members = meta?.members || []
  const peer = chat?.peer
  const isGroup = chat?.kind === 'group'

  const scrollToBottom = useCallback((smooth = false) => {
    const element = scrollRef.current
    if (!element) return
    element.scrollTo({ top: element.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  const loadMeta = useCallback(async () => {
    const data = await api.get(`/api/chats/${id}`)
    setMeta(data)
    return data
  }, [id])

  const loadMessages = useCallback(
    async (before) => {
      const query = before ? `?before=${encodeURIComponent(before)}` : ''
      const data = await api.get(`/api/chats/${id}/messages${query}`)
      setMessages((prev) => (before ? [...data.messages, ...prev] : data.messages))
      setHasMore(data.has_more)
      if (!before) api.post(`/api/chats/${id}/read`).catch(() => {})
      return data
    },
    [id],
  )

  useEffect(() => {
    let mounted = true
    setLoading(true)
    Promise.all([loadMeta(), loadMessages()])
      .then(() => mounted && requestAnimationFrame(() => scrollToBottom()))
      .catch((err) => mounted && setError(err.message))
      .finally(() => mounted && setLoading(false))
    return () => {
      mounted = false
    }
  }, [id, loadMeta, loadMessages, scrollToBottom])

  useEffect(() => {
    if (messages.length) requestAnimationFrame(() => scrollToBottom())
  }, [messages.length, scrollToBottom])

  useEffect(
    () =>
      onSocket((event) => {
        if (event.conversation_id !== id) return
        if (event.type === 'message:new') {
          setMessages((prev) =>
            prev.some((item) => item.id === event.message.id)
              ? prev
              : [...prev, event.message],
          )
          api.post(`/api/chats/${id}/read`).catch(() => {})
        } else if (event.type === 'receipt') {
          setMessages((prev) =>
            prev.map((item) =>
              event.message_ids.includes(item.id) ? { ...item, status: event.status } : item,
            ),
          )
        } else if (event.type === 'typing') {
          if (event.user_id === user?.id) return
          setTyping(true)
          clearTimeout(typingTimer.current)
          typingTimer.current = setTimeout(() => setTyping(false), 2800)
        } else if (event.type === 'conversation:updated') {
          loadMeta().catch(() => {})
          loadMessages().catch(() => {})
        }
      }),
    [id, loadMessages, loadMeta, user?.id],
  )

  useEffect(() => () => clearInterval(recordTimer.current), [])

  const sendMessage = async (payload) => {
    const data = await api.post(`/api/chats/${id}/messages`, payload)
    setMessages((prev) => [...prev, data.message])
    return data.message
  }

  const submitText = async (event) => {
    event?.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    setSending(true)
    try {
      await sendMessage({ kind: 'text', body })
    } catch (err) {
      setError(err.message)
      setText(body)
    } finally {
      setSending(false)
    }
  }

  const notifyTyping = () => {
    const now = Date.now()
    if (now - lastTypingAt.current < 2000) return
    lastTypingAt.current = now
    socketSend({ type: 'typing', conversation_id: id })
  }

  const uploadAndSend = async (file) => {
    if (!file) return
    setSheet(null)
    setSending(true)
    setError('')
    try {
      const kind = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : file.type.startsWith('audio/')
            ? 'audio'
            : 'file'
      const { media } = await api.upload(file)
      await sendMessage({
        kind,
        media_id: media.id,
        meta: { filename: media.filename, size: media.size, mime: media.mime },
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setSending(false)
    }
  }

  const shareLocation = () => {
    setSheet(null)
    if (!navigator.geolocation) {
      setError('الجهاز لا يدعم تحديد الموقع')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setSending(true)
        try {
          await sendMessage({
            kind: 'location',
            meta: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
          })
        } catch (err) {
          setError(err.message)
        } finally {
          setSending(false)
        }
      },
      () => setError('تعذّر الحصول على موقعك، تحقّق من أذونات الموقع'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const startRecording = async () => {
    setSheet(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('تسجيل الصوت غير مدعوم على هذا الجهاز')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data)
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording({ seconds: 0 })
      recordTimer.current = setInterval(
        () => setRecording((current) => (current ? { seconds: current.seconds + 1 } : current)),
        1000,
      )
    } catch {
      setError('تعذّر الوصول إلى الميكروفون، تحقّق من الأذونات')
    }
  }

  const stopRecording = (shouldSend) => {
    const recorder = recorderRef.current
    const seconds = recording?.seconds || 0
    clearInterval(recordTimer.current)
    setRecording(null)
    recorderRef.current = null
    if (!recorder) return
    const stream = recorder.stream

    if (!shouldSend) {
      recorder.onstop = null
      try {
        recorder.stop()
      } catch {
        /* already stopped */
      }
      stream.getTracks().forEach((track) => track.stop())
      return
    }

    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop())
      setSending(true)
      try {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const file = new File([blob], `voice-${Date.now()}.webm`, {
          type: recorder.mimeType || 'audio/webm',
        })
        const { media } = await api.upload(file)
        await sendMessage({
          kind: 'audio',
          media_id: media.id,
          meta: { duration: seconds, size: media.size },
        })
      } catch (err) {
        setError(err.message)
      } finally {
        setSending(false)
      }
    }
    try {
      recorder.stop()
    } catch {
      /* already stopped */
    }
  }

  const openMenu = async () => {
    setSheet('menu')
    if (!isGroup && peer && !peerInfo) {
      try {
        const data = await api.get(`/api/users/${peer.id}`)
        setPeerInfo(data)
      } catch {
        /* ignore */
      }
    }
  }

  const toggleBlock = async () => {
    if (!peer) return
    try {
      if (peerInfo?.blocked) await api.del(`/api/blocks/${peer.id}`)
      else await api.post(`/api/blocks/${peer.id}`)
      setSheet(null)
      navigate('/chats')
    } catch (err) {
      setError(err.message)
    }
  }

  const addContact = async () => {
    if (!peer) return
    try {
      await api.post('/api/contacts', { phone: peer.phone })
      setSheet(null)
      await loadMeta()
    } catch (err) {
      setError(err.message)
    }
  }

  const senderName = (senderId) => {
    const member = members.find((item) => item.user.id === senderId)
    return member?.user?.name || member?.user?.phone || ''
  }

  const subtitle = isGroup
    ? `${chat?.member_count || 0} عضو`
    : typing
      ? 'يكتب الآن…'
      : formatLastSeen(peer)

  return (
    <div className="flex h-full flex-col bg-canvas">
      <header className="z-20 flex items-center gap-1.5 border-b border-line bg-white px-2 py-2">
        <button type="button" className="icon-btn" onClick={() => navigate('/chats')} aria-label="رجوع">
          <Icon name="back" size={22} />
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2.5 text-right"
          onClick={() => (isGroup ? navigate(`/groups/${id}`) : setSheet('info'))}
        >
          {isGroup ? (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Icon name="users" size={20} />
            </span>
          ) : (
            <Avatar user={peer} size="sm" online={peer?.online} />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold leading-tight text-ink">
              {chat?.title || 'محادثة'}
            </span>
            <span
              className={`block truncate text-[11.5px] ${
                typing ? 'font-semibold text-brand' : 'text-muted'
              }`}
            >
              {subtitle}
            </span>
          </span>
        </button>
        {!isGroup && peer ? (
          <>
            <button
              type="button"
              className="icon-btn text-brand"
              onClick={() => startCall(peer, 'audio')}
              aria-label="مكالمة صوتية"
            >
              <Icon name="phone" size={20} />
            </button>
            <button
              type="button"
              className="icon-btn text-brand"
              onClick={() => startCall(peer, 'video')}
              aria-label="مكالمة مرئية"
            >
              <Icon name="video" size={21} />
            </button>
          </>
        ) : null}
        <button type="button" className="icon-btn" onClick={openMenu} aria-label="خيارات">
          <Icon name="more" size={20} />
        </button>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 py-3"
        style={{
          backgroundImage:
            'radial-gradient(rgba(15,107,87,0.055) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
        }}
      >
        {hasMore ? (
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              className="chip bg-white text-brand shadow-sm"
              onClick={() => loadMessages(messages[0]?.created_at).catch((err) => setError(err.message))}
            >
              تحميل الرسائل الأقدم
            </button>
          </div>
        ) : null}

        {loading ? (
          <p className="py-10 text-center text-[12.5px] text-muted">جارٍ تحميل الرسائل…</p>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center px-8 py-12 text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Icon name="chat" size={24} />
            </span>
            <p className="text-[13.5px] font-bold text-ink">ابدأ المحادثة</p>
            <p className="mt-1 text-[12px] leading-5 text-muted">
              أرسل رسالة، صورة، تسجيلًا صوتيًا أو موقعك.
            </p>
          </div>
        ) : (
          messages.map((message, index) => {
            const previous = messages[index - 1]
            const showDivider =
              !previous || formatDay(previous.created_at) !== formatDay(message.created_at)
            const own = message.sender_id === user?.id

            return (
              <div key={message.id}>
                {showDivider ? (
                  <div className="my-3 flex justify-center">
                    <span className="chip bg-white/90 text-[10.5px] font-semibold text-muted shadow-sm">
                      {formatDay(message.created_at)}
                    </span>
                  </div>
                ) : null}

                {message.kind === 'system' ? (
                  <div className="my-2 flex justify-center">
                    <span className="max-w-[85%] rounded-full bg-brand-tint px-3 py-1.5 text-center text-[11px] font-medium leading-5 text-brand-dark">
                      {message.body}
                    </span>
                  </div>
                ) : (
                  <div className={`mb-1.5 flex ${own ? 'justify-end' : 'justify-start'}`}>
                    <div className={`bubble ${own ? 'bubble-out' : 'bubble-in'}`}>
                      {isGroup && !own && senderName(message.sender_id) ? (
                        <p className="mb-0.5 text-[11px] font-bold text-brand">
                          {senderName(message.sender_id)}
                        </p>
                      ) : null}
                      {message.kind === 'text' ? (
                        <p className="whitespace-pre-wrap break-words">{message.body}</p>
                      ) : (
                        <Attachment message={message} own={own} />
                      )}
                      <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] text-muted">
                        <span>{formatClock(message.created_at)}</span>
                        {own ? <MessageStatus status={message.status} /> : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
        {typing ? (
          <div className="mb-2 flex justify-start">
            <span className="rounded-full bg-white px-3 py-2 text-[11px] font-medium text-muted shadow-sm">
              يكتب الآن…
            </span>
          </div>
        ) : null}
      </div>

      {error ? (
        <button
          type="button"
          onClick={() => setError('')}
          className="mx-3 mb-1 rounded-xl bg-danger/10 px-3 py-2 text-right text-[11.5px] font-medium text-danger"
        >
          {error} — اضغط للإخفاء
        </button>
      ) : null}

      {recording ? (
        <div className="safe-bottom flex items-center gap-3 border-t border-line bg-white px-3 py-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-danger/10 text-danger">
            <span className="h-3 w-3 animate-pulse rounded-full bg-danger" />
          </span>
          <span className="font-mono text-[13px] font-bold text-danger">
            {formatDuration(recording.seconds)}
          </span>
          <span className="flex-1 text-[11.5px] text-muted">جارٍ تسجيل رسالة صوتية…</span>
          <button
            type="button"
            className="icon-btn text-muted"
            onClick={() => stopRecording(false)}
            aria-label="إلغاء التسجيل"
          >
            <Icon name="trash" size={19} />
          </button>
          <button
            type="button"
            className="btn-primary h-10 w-10 rounded-full !px-0"
            onClick={() => stopRecording(true)}
            aria-label="إرسال التسجيل"
          >
            <Icon name="send" size={18} />
          </button>
        </div>
      ) : (
        <form
          onSubmit={submitText}
          className="safe-bottom flex items-end gap-1.5 border-t border-line bg-white px-2 py-2"
        >
          <button
            type="button"
            className="icon-btn text-brand"
            onClick={() => setSheet('attach')}
            aria-label="إرفاق"
          >
            <Icon name="clip" size={20} />
          </button>
          <input
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              notifyTyping()
            }}
            placeholder="اكتب رسالة…"
            className="field max-h-24 flex-1 resize-none py-2.5 text-[14px]"
            aria-label="نص الرسالة"
          />
          {text.trim() ? (
            <button
              type="submit"
              className="btn-primary h-10 w-10 rounded-full !px-0"
              disabled={sending}
              aria-label="إرسال"
            >
              <Icon name="send" size={18} />
            </button>
          ) : (
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand"
              onClick={startRecording}
              disabled={sending}
              aria-label="تسجيل رسالة صوتية"
            >
              <Icon name="mic" size={20} />
            </button>
          )}
        </form>
      )}

      <input
        ref={mediaInput}
        type="file"
        accept="image/*,video/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          uploadAndSend(file)
        }}
      />
      <input
        ref={fileInput}
        type="file"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          uploadAndSend(file)
        }}
      />

      <Sheet
        open={sheet === 'attach'}
        onClose={() => setSheet(null)}
        title="إرفاق"
      >
        <div className="grid grid-cols-2 gap-2 pb-4">
          <button
            type="button"
            className="flex flex-col items-center gap-2 rounded-2xl bg-brand-tint px-3 py-4 text-brand"
            onClick={() => mediaInput.current?.click()}
          >
            <Icon name="image" size={24} />
            <span className="text-[12.5px] font-semibold">صورة أو فيديو</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-2 rounded-2xl bg-brand-tint px-3 py-4 text-brand"
            onClick={() => fileInput.current?.click()}
          >
            <Icon name="file" size={24} />
            <span className="text-[12.5px] font-semibold">ملف</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-2 rounded-2xl bg-brand-tint px-3 py-4 text-brand"
            onClick={shareLocation}
          >
            <Icon name="pin" size={24} />
            <span className="text-[12.5px] font-semibold">الموقع</span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-2 rounded-2xl bg-brand-tint px-3 py-4 text-brand"
            onClick={startRecording}
          >
            <Icon name="mic" size={24} />
            <span className="text-[12.5px] font-semibold">تسجيل صوتي</span>
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === 'info'} onClose={() => setSheet(null)} title="معلومات المحادثة">
        {peer ? (
          <div className="pb-4">
            <div className="flex flex-col items-center gap-2 py-3">
              <Avatar user={peer} size="xl" />
              <p className="text-[16px] font-bold text-ink">{peer.name || peer.phone}</p>
              <p className="text-[12.5px] text-muted" dir="ltr">
                {peer.phone}
              </p>
              {peer.about ? (
                <p className="mt-1 max-w-[260px] text-center text-[12.5px] leading-5 text-ink/80">
                  {peer.about}
                </p>
              ) : null}
            </div>
            <div className="mt-2 space-y-2">
              <button
                type="button"
                className="btn-ghost w-full"
                onClick={() => {
                  setSheet(null)
                  startCall(peer, 'audio')
                }}
              >
                <Icon name="phone" size={17} />
                مكالمة صوتية
              </button>
              <button
                type="button"
                className="btn-ghost w-full"
                onClick={() => {
                  setSheet(null)
                  startCall(peer, 'video')
                }}
              >
                <Icon name="video" size={17} />
                مكالمة مرئية
              </button>
            </div>
          </div>
        ) : null}
      </Sheet>

      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title="خيارات المحادثة">
        <div className="pb-4">
          {isGroup ? (
            <button
              type="button"
              className="row-item rounded-xl"
              onClick={() => {
                setSheet(null)
                navigate(`/groups/${id}`)
              }}
            >
              <Icon name="info" size={20} className="text-brand" />
              <span className="flex-1 text-[13.5px] font-semibold">معلومات المجموعة والأعضاء</span>
              <Icon name="chevron" size={16} className="text-muted" />
            </button>
          ) : (
            <>
              {peer && !peer.is_contact ? (
                <button type="button" className="row-item rounded-xl" onClick={addContact}>
                  <Icon name="plus" size={20} className="text-brand" />
                  <span className="flex-1 text-[13.5px] font-semibold">إضافة إلى جهات الاتصال</span>
                </button>
              ) : null}
              <button type="button" className="row-item rounded-xl" onClick={toggleBlock}>
                <Icon name="ban" size={20} className="text-danger" />
                <span className="flex-1 text-[13.5px] font-semibold text-danger">
                  {peerInfo?.blocked ? 'إلغاء حظر المستخدم' : 'حظر المستخدم'}
                </span>
              </button>
            </>
          )}
          <p className="px-3 pt-3 text-[11px] leading-5 text-muted">
            تُحفظ الرسائل في حسابك، وحالة القراءة تتبع إعدادات الخصوصية لديك ولدى الطرف الآخر.
          </p>
        </div>
      </Sheet>
    </div>
  )
}
