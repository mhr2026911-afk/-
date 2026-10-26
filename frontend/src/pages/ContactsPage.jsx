import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import Icon from '../components/Icons'
import ScreenHeader from '../components/ScreenHeader'
import { api } from '../lib/api'
import { useCall } from '../lib/callContext'

export default function ContactsPage() {
  const [contacts, setContacts] = useState(null)
  const [phone, setPhone] = useState('')
  const [found, setFound] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { startCall } = useCall()
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const data = await api.get('/api/contacts')
      setContacts(data.contacts)
    } catch (err) {
      setError(err.message)
      setContacts([])
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const search = async (event) => {
    event.preventDefault()
    const value = phone.trim()
    if (value.replace(/\D/g, '').length < 6) {
      setError('أدخل رقم الهاتف مع مفتاح الدولة')
      return
    }
    setBusy(true)
    setError('')
    setFound(null)
    try {
      const data = await api.get(`/api/users/search?phone=${encodeURIComponent(value)}`)
      setFound(data.user)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const addContact = async (user) => {
    setBusy(true)
    setError('')
    try {
      await api.post('/api/contacts', { phone: user.phone })
      setFound(null)
      setPhone('')
      await load()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const openChat = async (user) => {
    setBusy(true)
    setError('')
    try {
      const data = await api.post('/api/chats/direct', { user_id: user.id })
      navigate(`/chats/${data.conversation.id}`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const removeContact = async (user) => {
    if (!window.confirm(`إزالة ${user.name || user.phone} من جهات الاتصال؟`)) return
    try {
      await api.del(`/api/contacts/${user.id}`)
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="pb-8">
      <ScreenHeader
        title="جهات الاتصال"
        subtitle="أضف المستخدمين المسجّلين برقم هاتفهم"
        onBack={() => navigate(-1)}
        right={
          <button type="button" className="icon-btn" onClick={() => navigate('/chats')} aria-label="المحادثات">
            <Icon name="chat" size={20} />
          </button>
        }
      />

      <div className="px-4 pt-4">
        <form onSubmit={search} className="rounded-2xl border border-line bg-white p-3.5 shadow-card">
          <label htmlFor="contact-phone" className="mb-1.5 block text-[12.5px] font-semibold text-ink">
            رقم الهاتف المسجّل في مرسال
          </label>
          <div className="flex gap-2">
            <input
              id="contact-phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+966 5X XXX XXXX"
              inputMode="tel"
              dir="ltr"
              className="field flex-1 text-left"
            />
            <button
              type="submit"
              className="btn-primary shrink-0 !px-4"
              disabled={busy}
              aria-label="بحث عن الرقم"
            >
              <Icon name="search" size={18} />
            </button>
          </div>
          <p className="mt-1.5 text-[11px] leading-5 text-muted">
            لا توجد حسابات تجريبية — يظهر فقط من سجّل رقمه فعليًا في مرسال.
          </p>
        </form>

        {error ? (
          <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-[12px] font-medium text-danger">
            {error}
          </p>
        ) : null}

        {found ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand-tint p-3">
            <Avatar user={found} size="md" online={found.online} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-bold text-ink">{found.name || found.phone}</p>
              <p className="text-[11.5px] text-muted" dir="ltr">
                {found.phone}
              </p>
              {found.about ? (
                <p className="truncate text-[11px] text-brand-dark">{found.about}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="chip bg-brand text-white"
              onClick={() => addContact(found)}
              disabled={busy}
            >
              {found.is_contact ? 'محادثة' : 'إضافة'}
            </button>
            {found.is_contact ? (
              <button
                type="button"
                className="icon-btn text-brand"
                onClick={() => openChat(found)}
                aria-label="فتح محادثة"
              >
                <Icon name="chat" size={18} />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between px-4">
        <h2 className="text-[12px] font-bold uppercase tracking-wide text-muted">
          جهات اتصالي {contacts?.length ? `(${contacts.length})` : ''}
        </h2>
      </div>

      {contacts === null ? (
        <p className="py-8 text-center text-[12.5px] text-muted">جارٍ التحميل…</p>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon="users"
          title="لا جهات اتصال بعد"
          description="ابحث برقم هاتف مسجّل في مرسال وأضفه لتتمكن من المحادثة والمكالمة."
        />
      ) : (
        <ul className="mx-3 mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className="flex items-center gap-3 border-b border-line/60 px-3 py-3 last:border-0"
            >
              <Avatar user={contact} size="md" online={contact.online} />
              <button type="button" className="min-w-0 flex-1 text-right" onClick={() => openChat(contact)}>
                <p className="truncate text-[13.5px] font-semibold text-ink">
                  {contact.name || contact.phone}
                </p>
                <p className="text-[11px] text-muted" dir="ltr">
                  {contact.phone}
                </p>
              </button>
              <button
                type="button"
                className="icon-btn text-brand"
                onClick={() => openChat(contact)}
                aria-label="مراسلة"
              >
                <Icon name="chat" size={18} />
              </button>
              <button
                type="button"
                className="icon-btn text-brand"
                onClick={() => startCall(contact, 'audio')}
                aria-label="اتصال صوتي"
              >
                <Icon name="phone" size={18} />
              </button>
              <button
                type="button"
                className="icon-btn text-muted"
                onClick={() => removeContact(contact)}
                aria-label="إزالة من جهات الاتصال"
              >
                <Icon name="trash" size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
