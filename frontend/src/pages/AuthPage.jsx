import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Brand from '../components/Brand'
import Icon from '../components/Icons'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'

const COUNTRIES = [
  { code: '+966', name: 'السعودية', flag: '🇸🇦' },
  { code: '+971', name: 'الإمارات', flag: '🇦🇪' },
  { code: '+20', name: 'مصر', flag: '🇪🇬' },
  { code: '+964', name: 'العراق', flag: '🇮🇶' },
  { code: '+962', name: 'الأردن', flag: '🇯🇴' },
  { code: '+965', name: 'الكويت', flag: '🇰🇼' },
  { code: '+974', name: 'قطر', flag: '🇶🇦' },
  { code: '+973', name: 'البحرين', flag: '🇧🇭' },
  { code: '+968', name: 'عُمان', flag: '🇴🇲' },
  { code: '+967', name: 'اليمن', flag: '🇾🇪' },
  { code: '+212', name: 'المغرب', flag: '🇲🇦' },
  { code: '+213', name: 'الجزائر', flag: '🇩🇿' },
  { code: '+216', name: 'تونس', flag: '🇹🇳' },
  { code: '+218', name: 'ليبيا', flag: '🇱🇾' },
  { code: '+249', name: 'السودان', flag: '🇸🇩' },
  { code: '+961', name: 'لبنان', flag: '🇱🇧' },
  { code: '+970', name: 'فلسطين', flag: '🇵🇸' },
  { code: '+90', name: 'تركيا', flag: '🇹🇷' },
]

export default function AuthPage() {
  const [step, setStep] = useState('phone')
  const [country, setCountry] = useState('+966')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [registered, setRegistered] = useState(true)
  const [devCode, setDevCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const timer = useRef(null)
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (cooldown <= 0) return undefined
    timer.current = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer.current)
  }, [cooldown])

  const fullPhone = `${country}${phone.replace(/^0+/, '').replace(/\D/g, '')}`

  const requestCode = async (event) => {
    event?.preventDefault()
    const digits = phone.replace(/\D/g, '').replace(/^0+/, '')
    if (digits.length < 6) {
      setError('أدخل رقم هاتف صحيحًا')
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = await api.post('/api/auth/request-code', { phone: fullPhone })
      setRegistered(data.registered)
      setDevCode(data.dev_code || '')
      setStep('code')
      setCooldown(60)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const verify = async (event) => {
    event?.preventDefault()
    if (code.replace(/\D/g, '').length < 4) {
      setError('أدخل رمز التحقق كاملًا')
      return
    }
    if (!registered && name.trim().length < 2) {
      setError('اكتب اسمك لإكمال إنشاء الحساب')
      return
    }
    setBusy(true)
    setError('')
    try {
      const data = await api.post('/api/auth/verify', {
        phone: fullPhone,
        code: code.trim(),
        name: registered ? undefined : name.trim(),
      })
      login(data.token, data.user, data.settings)
      navigate('/chats', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <div className="relative overflow-hidden bg-brand px-6 pb-14 pt-10 text-white">
        <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-48 w-48 rounded-full bg-gold/20" />
        <Brand size="lg" tone="light" />
        <p className="relative mt-6 max-w-[290px] text-[13.5px] leading-6 text-white/85">
          محادثات، حالات، مجموعات ومكالمات صوتية ومرئية — بتسجيل رقم هاتفك فقط وبخصوصية كاملة.
        </p>
      </div>

      <div className="relative -mt-8 flex-1 px-4 pb-10">
        <div className="card p-5">
          {step === 'phone' ? (
            <form onSubmit={requestCode} className="space-y-4">
              <div>
                <h1 className="text-xl font-extrabold text-ink">رقم هاتفك</h1>
                <p className="mt-1 text-[12.5px] leading-5 text-muted">
                  سنرسل رمز تحقق عبر رسالة نصية. لا نطلب بريدًا إلكترونيًا ولا نشارك رقمك مع أي جهة.
                </p>
              </div>
              <div className="flex gap-2">
                <select
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  className="field w-[112px] shrink-0 pl-2 text-[13px]"
                  aria-label="مفتاح الدولة"
                >
                  {COUNTRIES.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.flag} {item.code}
                    </option>
                  ))}
                </select>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/[^\d\s]/g, ''))}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="5XXXXXXXX"
                  className="field flex-1"
                  aria-label="رقم الهاتف"
                />
              </div>
              {error ? <p className="text-[12.5px] font-medium text-danger">{error}</p> : null}
              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? 'جارٍ الإرسال…' : 'إرسال رمز التحقق'}
                {!busy ? <Icon name="send" size={17} /> : null}
              </button>
              <div className="flex items-center gap-2 rounded-xl bg-brand-tint px-3 py-2.5 text-[11.5px] leading-5 text-brand-dark">
                <Icon name="shield" size={18} className="shrink-0" />
                <span>رمز التحقق صالح ٥ دقائق، والحساب مرتبط برقمك فقط.</span>
              </div>
            </form>
          ) : (
            <form onSubmit={verify} className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-extrabold text-ink">رمز التحقق</h1>
                  <p className="mt-1 text-[12.5px] leading-5 text-muted" dir="ltr">
                    {fullPhone}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-[12px] font-semibold text-brand"
                  onClick={() => {
                    setStep('phone')
                    setCode('')
                    setError('')
                  }}
                >
                  تغيير
                </button>
              </div>

              {devCode ? (
                <div className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-2.5">
                  <p className="text-[11px] font-semibold text-ink">وضع المعاينة — رمز التجربة</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="font-mono text-lg tracking-[0.3em] text-brand-dark">{devCode}</span>
                    <button
                      type="button"
                      className="chip bg-white text-brand"
                      onClick={() => setCode(devCode)}
                    >
                      استخدام
                    </button>
                  </div>
                </div>
              ) : null}

              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="— — — — — —"
                className="field text-center text-2xl tracking-[0.5em]"
                aria-label="رمز التحقق"
              />

              {!registered ? (
                <div>
                  <label htmlFor="name" className="mb-1.5 block text-[12.5px] font-semibold text-ink">
                    اسمك في مرسال
                  </label>
                  <input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={80}
                    placeholder="مثال: عبدالله السالم"
                    className="field"
                    autoComplete="name"
                  />
                  <p className="mt-1 text-[11px] text-muted">يظهر اسمك للمستخدمين الذين يتواصلون معك.</p>
                </div>
              ) : null}

              {error ? <p className="text-[12.5px] font-medium text-danger">{error}</p> : null}

              <button type="submit" className="btn-primary w-full" disabled={busy}>
                {busy ? 'جارٍ التحقق…' : registered ? 'تأكيد الدخول' : 'إنشاء الحساب والدخول'}
              </button>

              <button
                type="button"
                className="w-full text-center text-[12px] font-semibold text-brand disabled:text-muted"
                onClick={requestCode}
                disabled={cooldown > 0 || busy}
              >
                {cooldown > 0 ? `إعادة الإرسال بعد ${cooldown} ث` : 'إعادة إرسال الرمز'}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] leading-5 text-muted">
          بالمتابعة أنت توافق على شروط الاستخدام وسياسة الخصوصية في مرسال.
          <br />
          مرسال · الإصدار 1.0
        </p>
      </div>
    </div>
  )
}
