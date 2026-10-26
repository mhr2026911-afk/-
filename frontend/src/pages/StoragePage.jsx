import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icons'
import ScreenHeader from '../components/ScreenHeader'
import { ChoiceRow, Section, ToggleRow } from '../components/Settings'
import { api, backupDownloadUrl, mediaUrl } from '../lib/api'
import { useAuth } from '../lib/auth'
import { formatBytes, formatRelative } from '../lib/format'

const KIND_META = {
  image: { label: 'صور', color: 'bg-brand' },
  video: { label: 'فيديوهات', color: 'bg-emerald-500' },
  audio: { label: 'رسائل صوتية', color: 'bg-gold' },
  file: { label: 'ملفات', color: 'bg-sky-500' },
}

const PROTECTED_KEYS = ['mersal_token', 'mersal_pin_hash']

function tempBytes() {
  let total = 0
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (PROTECTED_KEYS.includes(key)) continue
    total += (localStorage.getItem(key)?.length || 0) * 2
  }
  return total
}

export default function StoragePage() {
  const { settings, updateSettings, refresh } = useAuth()
  const navigate = useNavigate()
  const [storage, setStorage] = useState(null)
  const [media, setMedia] = useState([])
  const [temp, setTemp] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const [usage, files] = await Promise.all([api.get('/api/storage'), api.get('/api/media')])
      setStorage(usage)
      setMedia(files.media)
    } catch (err) {
      setError(err.message)
      setStorage({ total: 0, items: [] })
    }
    setTemp(tempBytes())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const change = async (key, value) => {
    try {
      await updateSettings({ [key]: value })
    } catch (err) {
      setError(err.message)
    }
  }

  const clearTemp = async () => {
    const keys = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key && !PROTECTED_KEYS.includes(key)) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
    sessionStorage.clear()
    try {
      if (window.caches) {
        const names = await caches.keys()
        await Promise.all(names.map((name) => caches.delete(name)))
      }
    } catch {
      /* cache api unavailable */
    }
    setTemp(tempBytes())
    setMessage('تم مسح التخزين المؤقت')
  }

  const runBackup = async () => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await api.post('/api/backup/run')
      await refresh()
      setMessage(`تم إنشاء نسخة احتياطية بحجم ${formatBytes(result.size)} · ${result.messages} رسالة`)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const total = storage?.total || 0
  const images = media.filter((item) => item.kind === 'image').slice(0, 8)

  return (
    <div className="pb-10">
      <ScreenHeader
        title="التخزين والنسخ الاحتياطي"
        subtitle="مساحتك، التخزين المؤقت، والنسخ"
        onBack={() => navigate('/settings')}
      />

      <div className="px-4">
        {error ? (
          <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-[12px] font-medium text-danger">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-3 rounded-xl bg-brand-soft px-3 py-2 text-[12px] font-medium text-brand-dark">
            {message}
          </p>
        ) : null}

        <div className="mt-4 rounded-2xl border border-line bg-white p-4 shadow-card">
          <div className="flex items-baseline justify-between">
            <p className="text-[13px] font-bold text-ink">مساحة الوسائط المستخدمة</p>
            <p className="text-[13px] font-extrabold text-brand">{formatBytes(total)}</p>
          </div>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-canvas">
            {(storage?.items || []).map((item) => (
              <span
                key={item.kind}
                className={`${KIND_META[item.kind]?.color || 'bg-muted'} h-full`}
                style={{ width: `${total ? (item.bytes / total) * 100 : 0}%` }}
              />
            ))}
          </div>
          <ul className="mt-3 space-y-2">
            {(storage?.items || []).map((item) => (
              <li key={item.kind} className="flex items-center gap-2 text-[12px]">
                <span className={`h-2.5 w-2.5 rounded-full ${KIND_META[item.kind]?.color || 'bg-muted'}`} />
                <span className="flex-1 text-ink/80">
                  {KIND_META[item.kind]?.label || item.kind} · {item.count}
                </span>
                <span className="font-semibold text-muted">{formatBytes(item.bytes)}</span>
              </li>
            ))}
            {storage && storage.items.length === 0 ? (
              <li className="text-[12px] text-muted">لم ترفع أي وسائط بعد.</li>
            ) : null}
          </ul>
        </div>

        {images.length ? (
          <div className="mt-4">
            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted">أحدث الصور</p>
            <div className="grid grid-cols-4 gap-1.5">
              {images.map((item) => (
                <a
                  key={item.id}
                  href={mediaUrl(item.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="aspect-square overflow-hidden rounded-xl bg-canvas"
                >
                  <img
                    src={mediaUrl(item.id)}
                    alt={item.filename}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
          </div>
        ) : null}

        <Section title="التخزين المؤقت">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Icon name="clock" size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-ink">مساحة مؤقتة على الجهاز</p>
              <p className="text-[11.5px] text-muted">{formatBytes(temp)} من بيانات المعاينة المؤقتة</p>
            </div>
            <button type="button" className="chip bg-brand text-white" onClick={clearTemp}>
              مسح
            </button>
          </div>
        </Section>

        <Section title="النسخ الاحتياطي السحابي">
          <ToggleRow
            icon="cloud"
            title="نسخ احتياطي تلقائي"
            description="حفظ نسخة من محادثاتك ووسائطك في حسابك."
            checked={Boolean(settings?.auto_backup)}
            onChange={(value) => change('auto_backup', value)}
          />
          <div className="divider" />
          <ChoiceRow
            title="شبكة النسخ الاحتياطي"
            value={settings?.backup_network}
            options={[
              { value: 'wifi', label: 'Wi‑Fi فقط' },
              { value: 'any', label: 'Wi‑Fi وبيانات الجوال' },
            ]}
            onChange={(value) => change('backup_network', value)}
          />
          <div className="divider" />
          <div className="px-4 py-3.5">
            <p className="text-[11.5px] text-muted">
              آخر نسخة:{' '}
              {settings?.last_backup_at ? formatRelative(settings.last_backup_at) : 'لم تُنشأ بعد'}
            </p>
            <div className="mt-2.5 flex gap-2">
              <button type="button" className="btn-primary flex-1 !py-2.5 text-[12.5px]" onClick={runBackup} disabled={busy}>
                <Icon name="cloud" size={16} />
                {busy ? 'جارٍ النسخ…' : 'نسخ الآن'}
              </button>
              <a
                className="btn-outline flex-1 !py-2.5 text-[12.5px]"
                href={backupDownloadUrl()}
                target="_blank"
                rel="noreferrer"
              >
                <Icon name="download" size={16} />
                تنزيل النسخة
              </a>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-muted">
              تحتوي النسخة على ملفك وجهات اتصالك ومحادثاتك وحالاتك وسجل مكالماتك، وتُنزّل كملف
              JSON يمكنك الاحتفاظ به أو استعادته لاحقًا.
            </p>
          </div>
        </Section>
      </div>
    </div>
  )
}
