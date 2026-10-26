import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import Icon from '../components/Icons'
import ScreenHeader from '../components/ScreenHeader'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

export default function ProfilePage() {
  const { user, setUser } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState(user?.name || '')
  const [about, setAbout] = useState(user?.about || '')
  const [avatarId, setAvatarId] = useState(user?.avatar_media_id || null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const fileInput = useRef(null)

  const pickAvatar = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    setError('')
    try {
      const { media } = await api.upload(file)
      setAvatarId(media.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const save = async (event) => {
    event.preventDefault()
    if (name.trim().length < 2) {
      setError('اكتب اسمًا صحيحًا')
      return
    }
    setBusy(true)
    setError('')
    setSaved(false)
    try {
      const data = await api.patch('/api/users/me', {
        name: name.trim(),
        about: about.trim(),
        avatar_media_id: avatarId || '',
      })
      setUser(data.user)
      setSaved(true)
      setTimeout(() => setSaved(false), 2200)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pb-8">
      <ScreenHeader title="الملف الشخصي" subtitle="بياناتك الظاهرة لمن يتواصل معك" onBack={() => navigate('/settings')} />

      <form onSubmit={save} className="px-4 pt-5">
        <div className="flex flex-col items-center gap-2">
          <Avatar user={user} mediaId={avatarId} size="xl" />
          <button
            type="button"
            className="chip bg-brand-soft text-brand"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            <Icon name="camera" size={15} />
            تغيير الصورة
          </button>
          <p className="text-[11px] text-muted">صورة واضحة تُظهرك لجهات اتصالك</p>
          <input ref={fileInput} type="file" accept="image/*" hidden onChange={pickAvatar} />
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="profile-name" className="mb-1.5 block text-[12.5px] font-semibold">
              الاسم
            </label>
            <input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="field"
              maxLength={80}
            />
          </div>
          <div>
            <label htmlFor="profile-about" className="mb-1.5 block text-[12.5px] font-semibold">
              النبذة
            </label>
            <textarea
              id="profile-about"
              value={about}
              onChange={(event) => setAbout(event.target.value)}
              rows={3}
              maxLength={160}
              placeholder="متاح دائمًا للعائلة والعمل"
              className="field resize-none"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[12.5px] font-semibold">رقم الهاتف</label>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-canvas px-4 py-3">
              <Icon name="lock" size={16} className="text-muted" />
              <span className="flex-1 text-[14px]" dir="ltr">
                {user?.phone}
              </span>
              <span className="chip bg-white text-[10px] text-muted">مُوثّق</span>
            </div>
            <p className="mt-1 text-[11px] text-muted">
              رقم الهاتف هو معرّف حسابك ولا يمكن تغييره من هنا حفاظًا على أمان الحساب.
            </p>
          </div>
        </div>

        {error ? <p className="mt-3 text-[12px] font-medium text-danger">{error}</p> : null}

        <button type="submit" className="btn-primary mt-5 w-full" disabled={busy}>
          {busy ? 'جارٍ الحفظ…' : saved ? 'تم الحفظ' : 'حفظ التغييرات'}
        </button>
      </form>
    </div>
  )
}
