import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Avatar from '../components/Avatar'
import Icon from '../components/Icons'
import ScreenHeader from '../components/ScreenHeader'
import Sheet from '../components/Sheet'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { onSocket } from '../lib/socket'

export default function GroupInfoPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [contacts, setContacts] = useState([])
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const payload = await api.get(`/api/groups/${id}`)
      setData(payload)
      setTitle(payload.group.title)
    } catch (err) {
      setError(err.message)
    }
  }, [id])

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
        if (event.conversation_id === id && event.type === 'conversation:updated') load()
        if (event.type === 'conversation:deleted' && event.conversation_id === id) navigate('/groups')
      }),
    [id, load, navigate],
  )

  if (!data) {
    return (
      <div>
        <ScreenHeader title="المجموعة" onBack={() => navigate('/groups')} />
        <p className="py-12 text-center text-[12.5px] text-muted">
          {error || 'جارٍ تحميل معلومات المجموعة…'}
        </p>
      </div>
    )
  }

  const group = data.group
  const members = data.members || []
  const isAdmin = group.my_role === 'admin'
  const memberIds = members.map((member) => member.user.id)

  const act = async (action) => {
    setBusy(true)
    setError('')
    try {
      await action()
      setSheet(null)
      setSelectedMember(null)
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const saveTitle = () =>
    act(async () => {
      if (title.trim().length < 2) throw new Error('اسم المجموعة قصير جدًا')
      await api.patch(`/api/groups/${id}`, { title: title.trim() })
    })

  const addMember = (contact) =>
    act(async () => {
      await api.post(`/api/groups/${id}/members`, { user_id: contact.id })
    })

  const removeMember = (member) =>
    act(async () => {
      await api.del(`/api/groups/${id}/members/${member.user.id}`)
    })

  const promote = (member) =>
    act(async () => {
      await api.post(`/api/groups/${id}/admins/${member.user.id}`)
    })

  const demote = (member) =>
    act(async () => {
      await api.del(`/api/groups/${id}/admins/${member.user.id}`)
    })

  const leaveGroup = async () => {
    if (!window.confirm('هل تريد مغادرة المجموعة؟')) return
    try {
      await api.del(`/api/groups/${id}/members/${user.id}`)
      navigate('/groups')
    } catch (err) {
      setError(err.message)
    }
  }

  const deleteGroup = async () => {
    if (!window.confirm('سيتم حذف المجموعة ورسائلها للجميع. المتابعة؟')) return
    try {
      await api.del(`/api/groups/${id}`)
      navigate('/groups')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="pb-6">
      <ScreenHeader
        title="معلومات المجموعة"
        subtitle={`${group.member_count} عضو`}
        onBack={() => navigate('/groups')}
        right={
          <button
            type="button"
            className="icon-btn"
            onClick={() => navigate(`/chats/${id}`)}
            aria-label="فتح المحادثة"
          >
            <Icon name="chat" size={20} />
          </button>
        }
      />

      <div className="flex flex-col items-center gap-2 bg-gradient-to-b from-brand-tint to-white px-5 py-6">
        <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand text-white shadow-card">
          <Icon name="users" size={34} />
        </span>
        <h2 className="mt-1 text-center text-lg font-extrabold text-ink">{group.title}</h2>
        <p className="text-[12px] text-muted">{group.member_count} عضو</p>
        {data.about ? (
          <p className="max-w-[300px] text-center text-[12.5px] leading-6 text-ink/75">{data.about}</p>
        ) : null}
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn-ghost !py-2 text-[12.5px]" onClick={() => navigate(`/chats/${id}`)}>
            <Icon name="chat" size={16} />
            فتح المحادثة
          </button>
          {isAdmin ? (
            <button
              type="button"
              className="btn-outline !py-2 text-[12.5px]"
              onClick={() => setSheet('edit')}
              aria-label="تعديل المجموعة"
            >
              <Icon name="settings" size={16} />
              تعديل
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="mx-4 mt-3 rounded-xl bg-danger/10 px-3 py-2 text-[12px] font-medium text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-3 flex items-center justify-between px-4">
        <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted">الأعضاء</h3>
        {isAdmin ? (
          <button
            type="button"
            className="text-[12px] font-semibold text-brand"
            onClick={() => setSheet('add')}
          >
            إضافة عضو
          </button>
        ) : null}
      </div>

      <ul className="mx-3 mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        {members.map((member) => (
          <li key={member.user.id} className="border-b border-line/60 last:border-0">
            <button
              type="button"
              className="flex w-full items-center gap-3 px-3 py-3 text-right"
              onClick={() => {
                if (!isAdmin || member.user.id === user.id) return
                setSelectedMember(member)
                setSheet('member')
              }}
            >
              <Avatar user={member.user} size="sm" online={member.user.online} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-ink">
                  {member.user.name || member.user.phone}
                  {member.user.id === user.id ? (
                    <span className="mr-1 text-[11px] font-medium text-muted">(أنت)</span>
                  ) : null}
                </p>
                <p className="text-[11px] text-muted" dir="ltr">
                  {member.user.phone}
                </p>
              </div>
              {member.role === 'admin' ? (
                <span className="chip bg-gold/15 text-gold">مشرف</span>
              ) : null}
              {isAdmin && member.user.id !== user.id ? (
                <Icon name="more" size={17} className="text-muted" />
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      <div className="mx-3 mt-4 space-y-2">
        {isAdmin ? (
          <button type="button" className="btn-danger w-full" onClick={deleteGroup}>
            <Icon name="trash" size={17} />
            حذف المجموعة
          </button>
        ) : null}
        <button type="button" className="btn-outline w-full" onClick={leaveGroup}>
          <Icon name="logout" size={17} />
          مغادرة المجموعة
        </button>
      </div>

      <Sheet open={sheet === 'edit'} onClose={() => setSheet(null)} title="تعديل المجموعة">
        <div className="pb-4">
          <label className="mb-1.5 block text-[12.5px] font-semibold" htmlFor="edit-title">
            اسم المجموعة
          </label>
          <input
            id="edit-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="field"
            maxLength={120}
          />
          <button type="button" className="btn-primary mt-3 w-full" onClick={saveTitle} disabled={busy}>
            حفظ التغييرات
          </button>
          <p className="mt-2 text-[11px] leading-5 text-muted">
            صلاحيات المشرف تشمل تعديل الاسم، إضافة الأعضاء وإزالتهم، وتعيين مشرفين آخرين.
          </p>
        </div>
      </Sheet>

      <Sheet open={sheet === 'add'} onClose={() => setSheet(null)} title="إضافة عضو">
        <div className="pb-4">
          {contacts.filter((contact) => !memberIds.includes(contact.id)).length === 0 ? (
            <p className="py-6 text-center text-[12.5px] leading-6 text-muted">
              كل جهات اتصالك موجودون في المجموعة، أو لا توجد جهات اتصال بعد.
            </p>
          ) : (
            <ul className="divide-y divide-line/60">
              {contacts
                .filter((contact) => !memberIds.includes(contact.id))
                .map((contact) => (
                  <li key={contact.id} className="flex items-center gap-3 py-2.5">
                    <Avatar user={contact} size="sm" />
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
                      className="chip bg-brand text-white"
                      onClick={() => addMember(contact)}
                      disabled={busy}
                    >
                      إضافة
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'member'}
        onClose={() => {
          setSheet(null)
          setSelectedMember(null)
        }}
        title={selectedMember?.user?.name || 'إدارة العضو'}
      >
        {selectedMember ? (
          <div className="space-y-2 pb-4">
            {selectedMember.role === 'admin' ? (
              <button
                type="button"
                className="btn-outline w-full"
                onClick={() => demote(selectedMember)}
                disabled={busy}
              >
                إزالته من المشرفين
              </button>
            ) : (
              <button
                type="button"
                className="btn-ghost w-full"
                onClick={() => promote(selectedMember)}
                disabled={busy}
              >
                <Icon name="shield" size={17} />
                تعيينه مشرفًا
              </button>
            )}
            <button
              type="button"
              className="btn-danger w-full"
              onClick={() => removeMember(selectedMember)}
              disabled={busy}
            >
              <Icon name="trash" size={17} />
              إزالته من المجموعة
            </button>
          </div>
        ) : null}
      </Sheet>
    </div>
  )
}
