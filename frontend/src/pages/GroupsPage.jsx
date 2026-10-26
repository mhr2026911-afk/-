import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import Icon from '../components/Icons'
import Sheet from '../components/Sheet'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatRelative, messagePreview } from '../lib/format'
import { onSocket } from '../lib/socket'

export default function GroupsPage() {
  const { user } = useAuth()
  const [groups, setGroups] = useState(null)
  const [contacts, setContacts] = useState([])
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const data = await api.get('/api/groups')
      setGroups(data.groups)
    } catch (err) {
      setError(err.message)
      setGroups([])
    }
  }, [])

  useEffect(() => {
    load()
    api
      .get('/api/contacts')
      .then((data) => setContacts(data.contacts))
      .catch(() => setContacts([]))
  }, [load])

  useEffect(
    () =>
      onSocket((event) => {
        if (['conversation:updated', 'conversation:deleted', 'message:new'].includes(event.type)) {
          load()
        }
      }),
    [load],
  )

  const toggleMember = (id) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  const createGroup = async () => {
    if (title.trim().length < 2) {
      setError('اكتب اسمًا للمجموعة')
      return
    }
    if (selected.length === 0) {
      setError('اختر عضوًا واحدًا على الأقل')
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = await api.post('/api/groups', { title: title.trim(), member_ids: selected })
      setCreateOpen(false)
      setTitle('')
      setSelected([])
      navigate(`/groups/${data.group.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pb-4">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line/70 bg-white/95 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-[17px] font-extrabold text-ink">المجموعات</h1>
          <p className="text-[11px] text-muted">أنشئ مجموعة وأدر أعضاءها كمشرف</p>
        </div>
        <button type="button" className="btn-ghost !px-3 !py-2 text-[12.5px]" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={16} />
          مجموعة جديدة
        </button>
      </header>

      {error ? (
        <p className="mx-4 mt-3 rounded-xl bg-danger/10 px-3 py-2 text-[12px] font-medium text-danger">
          {error}
        </p>
      ) : null}

      {groups === null ? (
        <div className="space-y-3 px-4 py-5">
          {[0, 1].map((index) => (
            <div key={index} className="flex animate-pulse items-center gap-3">
              <span className="h-12 w-12 rounded-full bg-line" />
              <div className="flex-1 space-y-2">
                <span className="block h-3 w-1/3 rounded bg-line" />
                <span className="block h-3 w-1/2 rounded bg-line/70" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon="users"
          title="لا توجد مجموعات"
          description="أنشئ مجموعة للعائلة أو العمل، وأضف الأعضاء وتحكّم في الصلاحيات."
          action={
            <button type="button" className="btn-primary px-5" onClick={() => setCreateOpen(true)}>
              <Icon name="plus" size={17} />
              إنشاء مجموعة
            </button>
          }
        />
      ) : (
        <ul className="divide-y divide-line/70">
          {groups.map((group) => (
            <li key={group.id} className="flex items-center">
              <Link to={`/chats/${group.id}`} className="row-item flex-1">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <Icon name="users" size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[14.5px] font-bold text-ink">{group.title}</p>
                    <span className="shrink-0 text-[10.5px] text-muted">
                      {formatRelative(group.last_message_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className="truncate text-[12px] text-muted">
                      {messagePreview(group.last_message) || `${group.member_count} عضو`}
                    </p>
                    {group.my_role === 'admin' ? (
                      <span className="chip shrink-0 bg-gold/15 text-[10px] text-gold">مشرف</span>
                    ) : null}
                  </div>
                </div>
              </Link>
              <Link
                to={`/groups/${group.id}`}
                className="icon-btn m-1 text-muted"
                aria-label="إدارة المجموعة"
              >
                <Icon name="info" size={19} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={createOpen} onClose={() => setCreateOpen(false)} title="مجموعة جديدة">
        <div className="pb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold" htmlFor="group-title">
            اسم المجموعة
          </label>
          <input
            id="group-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="مثال: العائلة"
            maxLength={120}
            className="field"
          />

          <p className="mb-2 mt-4 text-[12.5px] font-semibold">
            الأعضاء ({selected.length})
          </p>
          {contacts.length === 0 ? (
            <div className="rounded-xl bg-brand-tint px-3 py-3 text-[12px] leading-5 text-brand-dark">
              لا توجد جهات اتصال بعد. أضف مستخدمين مسجّلين من صفحة جهات الاتصال ثم أنشئ المجموعة.
              <Link to="/contacts" className="mt-2 block font-bold underline">
                إضافة مستخدم مسجّل
              </Link>
            </div>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {contacts.map((contact) => {
                const checked = selected.includes(contact.id)
                return (
                  <li key={contact.id}>
                    <button
                      type="button"
                      onClick={() => toggleMember(contact.id)}
                      className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-right transition ${
                        checked ? 'bg-brand-soft' : 'hover:bg-canvas'
                      }`}
                    >
                      <Avatar user={contact} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold">
                          {contact.name || contact.phone}
                        </span>
                        <span className="block text-[11px] text-muted" dir="ltr">
                          {contact.phone}
                        </span>
                      </span>
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                          checked ? 'border-brand bg-brand text-white' : 'border-line'
                        }`}
                      >
                        {checked ? <Icon name="check" size={13} strokeWidth={3} /> : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          <button type="button" className="btn-primary mt-4 w-full" onClick={createGroup} disabled={busy}>
            {busy ? 'جارٍ الإنشاء…' : 'إنشاء المجموعة'}
          </button>
          <p className="mt-2 text-[11px] leading-5 text-muted">
            ستصبح مشرفًا للمجموعة ويمكنك إضافة الأعضاء وإزالتهم وتعيين مشرفين آخرين.
          </p>
        </div>
      </Sheet>

      {user ? <span className="hidden">{user.id}</span> : null}
    </div>
  )
}
