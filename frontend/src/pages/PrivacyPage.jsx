import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import Icon from '../components/Icons'
import ScreenHeader from '../components/ScreenHeader'
import Sheet from '../components/Sheet'
import { ChoiceRow, Section, ToggleRow } from '../components/Settings'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { clearPin, hashPin, pinIsSet, savePinHash } from '../lib/pin'

const PRIVACY_OPTIONS = [
  { value: 'everyone', label: 'الجميع' },
  { value: 'contacts', label: 'جهات اتصالي' },
  { value: 'nobody', label: 'لا أحد' },
]

export default function PrivacyPage() {
  const { settings, updateSettings } = useAuth()
  const navigate = useNavigate()
  const [blocks, setBlocks] = useState(null)
  const [error, setError] = useState('')
  const [pinOpen, setPinOpen] = useState(false)
  const [pin, setPin] = useState('')
  const [pinBusy, setPinBusy] = useState(false)

  const loadBlocks = useCallback(async () => {
    try {
      const data = await api.get('/api/blocks')
      setBlocks(data.blocked)
    } catch (err) {
      setError(err.message)
      setBlocks([])
    }
  }, [])

  useEffect(() => {
    loadBlocks()
  }, [loadBlocks])

  const change = async (key, value) => {
    setError('')
    try {
      await updateSettings({ [key]: value })
    } catch (err) {
      setError(err.message)
    }
  }

  const unblock = async (userId) => {
    try {
      await api.del(`/api/blocks/${userId}`)
      loadBlocks()
    } catch (err) {
      setError(err.message)
    }
  }

  const handleAppLock = async (enabled) => {
    if (enabled) {
      if (pinIsSet()) {
        await change('app_lock', true)
      } else {
        setPin('')
        setPinOpen(true)
      }
      return
    }
    clearPin()
    await change('app_lock', false)
  }

  const confirmPin = async () => {
    if (!/^\d{4}$/.test(pin)) {
      setError('أدخل ٤ أرقام')
      return
    }
    setPinBusy(true)
    setError('')
    try {
      savePinHash(await hashPin(pin))
      await updateSettings({ app_lock: true })
      setPinOpen(false)
      setPin('')
    } catch (err) {
      setError(err.message)
    } finally {
      setPinBusy(false)
    }
  }

  return (
    <div className="pb-10">
      <ScreenHeader
        title="الحماية والخصوصية والأمان"
        subtitle="تحكّم بمن يراك وكيف"
        onBack={() => navigate('/settings')}
      />

      <div className="px-4">
        {error ? (
          <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-[12px] font-medium text-danger">
            {error}
          </p>
        ) : null}

        <Section title="الظهور وحالة الاتصال">
          <ToggleRow
            icon="globe"
            title="إظهار حالة الاتصال"
            description="عند الإيقاف لن يرى الآخرون أنك متصل الآن."
            checked={Boolean(settings?.show_online)}
            onChange={(value) => change('show_online', value)}
          />
          <div className="divider" />
          <ToggleRow
            icon="clock"
            title="إظهار آخر ظهور"
            description="إخفاء وقت آخر ظهور لك في المحادثات."
            checked={Boolean(settings?.show_last_seen)}
            onChange={(value) => change('show_last_seen', value)}
          />
        </Section>

        <Section title="الخصوصية">
          <ChoiceRow
            title="من يرى صورة ملفك الشخصي"
            value={settings?.profile_photo_privacy}
            options={PRIVACY_OPTIONS}
            onChange={(value) => change('profile_photo_privacy', value)}
          />
          <div className="divider" />
          <ChoiceRow
            title="من يستطيع مراسلتك"
            description="يُطبَّق على بدء المحادثات وإرسال الرسائل."
            value={settings?.messages_privacy}
            options={PRIVACY_OPTIONS}
            onChange={(value) => change('messages_privacy', value)}
          />
          <div className="divider" />
          <ChoiceRow
            title="من يستطيع الاتصال بك"
            description="مكالمات صوتية ومرئية."
            value={settings?.calls_privacy}
            options={PRIVACY_OPTIONS}
            onChange={(value) => change('calls_privacy', value)}
          />
          <div className="divider" />
          <ChoiceRow
            title="من يستطيع إضافتك إلى مجموعات"
            value={settings?.groups_privacy}
            options={PRIVACY_OPTIONS}
            onChange={(value) => change('groups_privacy', value)}
          />
        </Section>

        <Section title="الرسائل والأمان">
          <ToggleRow
            icon="checks"
            title="إشعارات القراءة"
            description="عند الإيقاف لن يظهر للطرف الآخر أنك قرأت رسائله."
            checked={Boolean(settings?.read_receipts)}
            onChange={(value) => change('read_receipts', value)}
          />
          <div className="divider" />
          <ToggleRow
            icon="lock"
            title="قفل التطبيق برمز"
            description="رمز من ٤ أرقام يُطلب عند فتح مرسال على هذا الجهاز."
            checked={Boolean(settings?.app_lock)}
            onChange={handleAppLock}
          />
        </Section>

        <Section title={`المستخدمون المحظورون${blocks?.length ? ` (${blocks.length})` : ''}`}>
          {blocks === null ? (
            <p className="px-4 py-4 text-[12px] text-muted">جارٍ التحميل…</p>
          ) : blocks.length === 0 ? (
            <p className="px-4 py-4 text-[12px] leading-6 text-muted">
              لا يوجد مستخدمون محظورون. يمكنك حظر أي مستخدم من داخل المحادثة.
            </p>
          ) : (
            blocks.map((blocked) => (
              <div key={blocked.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar user={blocked} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold">
                    {blocked.name || blocked.phone}
                  </p>
                  <p className="text-[11px] text-muted">لا يمكنه مراسلتك أو الاتصال بك</p>
                </div>
                <button
                  type="button"
                  className="chip bg-brand-soft text-brand"
                  onClick={() => unblock(blocked.id)}
                >
                  إلغاء الحظر
                </button>
              </div>
            ))
          )}
        </Section>

        <div className="mt-4 rounded-2xl border border-line bg-brand-tint p-4">
          <div className="flex items-start gap-2">
            <Icon name="shield" size={18} className="mt-0.5 shrink-0 text-brand" />
            <p className="text-[11.5px] leading-6 text-brand-dark">
              خصوصيتك مطبّقة من الخادم: منع الرسائل والمكالمات يمنعها فعليًا، وإخفاء الظهور يوقف
              إرسال حالتك للآخرين. رمز قفل التطبيق يُخزّن مشفّرًا على جهازك فقط.
            </p>
          </div>
        </div>
      </div>

      <Sheet open={pinOpen} onClose={() => setPinOpen(false)} title="تعيين رمز القفل">
        <div className="pb-4">
          <p className="mb-3 text-[12px] leading-6 text-muted">
            اختر رمزًا من ٤ أرقام. سيُطلب منك عند كل فتح لتطبيق مرسال على هذا الجهاز.
          </p>
          <input
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            placeholder="••••"
            className="field text-center text-2xl tracking-[0.5em]"
            aria-label="رمز القفل"
          />
          <button type="button" className="btn-primary mt-3 w-full" onClick={confirmPin} disabled={pinBusy}>
            {pinBusy ? 'جارٍ الحفظ…' : 'تفعيل القفل'}
          </button>
        </div>
      </Sheet>
    </div>
  )
}
