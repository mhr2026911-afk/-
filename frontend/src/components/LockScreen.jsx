import { useState } from 'react'
import Brand from './Brand'
import Icon from './Icons'
import { getPinHash, hashPin } from '../lib/pin'
import { useAuth } from '../lib/auth'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'empty', '0', 'delete']

export default function LockScreen({ onUnlock }) {
  const { logout } = useAuth()
  const [digits, setDigits] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  const verify = async (value) => {
    setChecking(true)
    try {
      const hash = await hashPin(value)
      if (hash === getPinHash()) {
        setError('')
        onUnlock()
      } else {
        setError('الرمز غير صحيح')
        setDigits('')
      }
    } finally {
      setChecking(false)
    }
  }

  const press = (key) => {
    if (checking) return
    if (key === 'delete') {
      setDigits((current) => current.slice(0, -1))
      setError('')
      return
    }
    if (key === 'empty') return
    const next = (digits + key).slice(0, 4)
    setDigits(next)
    setError('')
    if (next.length === 4) verify(next)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-brand-deep via-brand-dark to-[#061f19] px-6 py-10 text-white">
      <Brand size="md" tone="light" />
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
          <Icon name="lock" size={28} />
        </span>
        <h1 className="text-lg font-bold">مرسال مقفل</h1>
        <p className="text-[12.5px] text-white/70">أدخل رمز القفل المكوّن من ٤ أرقام</p>

        <div className="mt-2 flex gap-3">
          {[0, 1, 2, 3].map((index) => (
            <span
              key={index}
              className={`h-3 w-3 rounded-full ${
                index < digits.length ? 'bg-white' : 'bg-white/25'
              }`}
            />
          ))}
        </div>
        {error ? <p className="text-[12px] font-medium text-rose-200">{error}</p> : null}
      </div>

      <div className="mx-auto grid w-full max-w-[260px] grid-cols-3 gap-3">
        {KEYS.map((key) =>
          key === 'empty' ? (
            <span key={key} />
          ) : (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              className="flex h-16 items-center justify-center rounded-2xl bg-white/10 text-xl font-semibold text-white active:scale-95"
              aria-label={key === 'delete' ? 'حذف رقم' : `الرقم ${key}`}
            >
              {key === 'delete' ? <Icon name="close" size={20} /> : key}
            </button>
          ),
        )}
      </div>

      <button
        type="button"
        onClick={logout}
        className="mx-auto mt-6 text-[12px] font-medium text-white/60 underline"
      >
        تسجيل الخروج من هذا الجهاز
      </button>
    </div>
  )
}
