import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import Icon from '../components/Icons'
import Sheet from '../components/Sheet'
import { api } from '../lib/api'
import { useCall } from '../lib/callContext'
import { formatCallDuration, formatRelative } from '../lib/format'
import { onSocket } from '../lib/socket'

function isMissed(call) {
  return call.direction === 'incoming' && ['missed', 'declined', 'ringing'].includes(call.status)
}

function callStatusLabel(call) {
  if (call.duration > 0) return formatCallDuration(call.duration)
  if (call.status === 'declined') return 'مرفوضة'
  if (call.status === 'missed' || call.status === 'ringing') return 'فائتة'
  if (call.status === 'answered') return 'مكتملة'
  return 'صادرة'
}

export default function CallsPage() {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('all')
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState(false)
  const [contacts, setContacts] = useState([])
  const { startCall } = useCall()
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const payload = await api.get('/api/calls')
      setData(payload)
      if (payload.missed > 0) api.post('/api/calls/seen').catch(() => {})
    } catch (err) {
      setError(err.message)
      setData({ calls: [], missed: 0 })
    }
  }, [])

  useEffect(() => {
    load()
    api
      .get('/api/contacts')
      .then((payload) => setContacts(payload.contacts))
      .catch(() => setContacts([]))
  }, [load])

  useEffect(
    () =>
      onSocket((event) => {
        if (event.type === 'call:update') load()
      }),
    [load],
  )

  const calls = data?.calls || []
  const visible = tab === 'missed' ? calls.filter(isMissed) : calls

  const call = async (peer, kind) => {
    setSheet(false)
    await startCall(peer, kind)
  }

  return (
    <div className="pb-4">
      <header className="sticky top-0 z-20 border-b border-line/70 bg-white/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-[17px] font-extrabold text-ink">المكالمات</h1>
            <p className="text-[11px] text-muted">صوتية ومرئية داخل مرسال</p>
          </div>
          <button
            type="button"
            className="btn-ghost !px-3 !py-2 text-[12.5px]"
            onClick={() => setSheet(true)}
          >
            <Icon name="phone" size={16} />
            مكالمة جديدة
          </button>
        </div>
        <div className="flex gap-1 px-3 pb-2">
          {[
            { key: 'all', label: 'الكل' },
            { key: 'missed', label: `الفائتة${data?.missed ? ` (${data.missed})` : ''}` },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setTab(item.key)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
                tab === item.key ? 'bg-brand text-white' : 'bg-canvas text-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {error ? (
        <p className="mx-4 mt-3 rounded-xl bg-danger/10 px-3 py-2 text-[12px] font-medium text-danger">
          {error}
        </p>
      ) : null}

      {data === null ? (
        <div className="space-y-3 px-4 py-5">
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex animate-pulse items-center gap-3">
              <span className="h-11 w-11 rounded-full bg-line" />
              <div className="flex-1 space-y-2">
                <span className="block h-3 w-1/3 rounded bg-line" />
                <span className="block h-3 w-1/4 rounded bg-line/70" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon="phone"
          title={tab === 'missed' ? 'لا مكالمات فائتة' : 'لا توجد مكالمات بعد'}
          description="ابدأ مكالمة صوتية أو مرئية مع من في جهات اتصالك."
          action={
            <button type="button" className="btn-primary px-5" onClick={() => setSheet(true)}>
              <Icon name="phone" size={17} />
              مكالمة جديدة
            </button>
          }
        />
      ) : (
        <ul className="divide-y divide-line/70">
          {visible.map((callItem) => {
            const peer = callItem.peer
            const missed = isMissed(callItem)
            return (
              <li key={callItem.id} className="flex items-center gap-2 px-4 py-3">
                <Avatar user={peer} size="md" />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-right"
                  onClick={() => (peer ? call(peer, callItem.kind) : navigate('/contacts'))}
                >
                  <p className={`truncate text-[14px] font-bold ${missed ? 'text-danger' : 'text-ink'}`}>
                    {peer?.name || peer?.phone || 'مستخدم مرسال'}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted">
                    <Icon
                      name={missed ? 'phoneMissed' : callItem.direction === 'outgoing' ? 'phoneOut' : 'phoneIn'}
                      size={13}
                      className={missed ? 'text-danger' : 'text-brand'}
                    />
                    {callStatusLabel(callItem)} · {formatRelative(callItem.created_at)}
                  </p>
                </button>
                {peer ? (
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      className="icon-btn text-brand"
                      onClick={() => call(peer, 'audio')}
                      aria-label={`مكالمة صوتية مع ${peer.name || peer.phone}`}
                    >
                      <Icon name="phone" size={18} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn text-brand"
                      onClick={() => call(peer, 'video')}
                      aria-label={`مكالمة مرئية مع ${peer.name || peer.phone}`}
                    >
                      <Icon name="video" size={19} />
                    </button>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <Sheet open={sheet} onClose={() => setSheet(false)} title="اختر من تريد الاتصال به">
        <div className="pb-4">
          {contacts.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-[12.5px] leading-6 text-muted">
                لا توجد جهات اتصال بعد. أضف مستخدمًا مسجّلًا لتبدأ المكالمات.
              </p>
              <button
                type="button"
                className="btn-primary mt-3 px-4"
                onClick={() => {
                  setSheet(false)
                  navigate('/contacts')
                }}
              >
                <Icon name="plus" size={16} />
                إضافة جهة اتصال
              </button>
            </div>
          ) : (
            <ul className="divide-y divide-line/60">
              {contacts.map((contact) => (
                <li key={contact.id} className="flex items-center gap-3 py-2.5">
                  <Avatar user={contact} size="sm" online={contact.online} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold">
                      {contact.name || contact.phone}
                    </p>
                    <p className="text-[11px] text-muted" dir="ltr">
                      {contact.phone}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="icon-btn text-brand"
                    onClick={() => call(contact, 'audio')}
                    aria-label="مكالمة صوتية"
                  >
                    <Icon name="phone" size={18} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn text-brand"
                    onClick={() => call(contact, 'video')}
                    aria-label="مكالمة مرئية"
                  >
                    <Icon name="video" size={19} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Sheet>
    </div>
  )
}
