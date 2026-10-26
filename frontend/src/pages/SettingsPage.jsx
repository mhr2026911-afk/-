import { Link, useNavigate } from 'react-router-dom'
import Avatar from '../components/Avatar'
import Icon from '../components/Icons'
import { useAuth } from '../lib/auth'

const ROWS = [
  {
    to: '/settings/profile',
    icon: 'user',
    label: 'الملف الشخصي',
    description: 'الاسم، الصورة، والنبذة',
  },
  {
    to: '/settings/privacy',
    icon: 'shield',
    label: 'الحماية والخصوصية والأمان',
    description: 'من يرى معلوماتك، الحظر، قفل التطبيق',
  },
  {
    to: '/settings/notifications',
    icon: 'bell',
    label: 'الإشعارات',
    description: 'الرسائل، المكالمات، الحالات',
  },
  {
    to: '/settings/storage',
    icon: 'storage',
    label: 'التخزين والنسخ الاحتياطي',
    description: 'المساحة، التخزين المؤقت، النسخ',
  },
  {
    to: '/contacts',
    icon: 'users',
    label: 'جهات الاتصال والمستخدمون',
    description: 'إضافة مستخدمين مسجّلين في مرسال',
  },
]

export default function SettingsPage() {
  const { user, settings, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="pb-8">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line/70 bg-white/95 px-4 py-3 backdrop-blur">
        <div>
          <h1 className="text-[17px] font-extrabold text-ink">الإعدادات</h1>
          <p className="text-[11px] text-muted">حسابك خصوصيتك وتخزينك</p>
        </div>
        <Icon name="settings" size={20} className="text-muted" />
      </header>

      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={() => navigate('/settings/profile')}
          className="flex w-full items-center gap-3 rounded-2xl border border-line bg-white p-4 text-right shadow-card"
        >
          <Avatar user={user} size="lg" online={user?.online} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15.5px] font-extrabold text-ink">
              {user?.name || 'مستخدم مرسال'}
            </span>
            <span className="block truncate text-[12px] text-muted" dir="ltr">
              {user?.phone}
            </span>
            <span className="mt-1 block truncate text-[11.5px] text-brand">
              {user?.about || 'أضف نبذة عنك'}
            </span>
          </span>
          <Icon name="chevron" size={18} className="text-muted" />
        </button>
      </div>

      <div className="mt-4 overflow-hidden border-y border-line bg-white">
        {ROWS.map((row) => (
          <Link
            key={row.to}
            to={row.to}
            className="flex items-center gap-3 border-b border-line/60 px-4 py-3.5 last:border-0 active:bg-brand-tint"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
              <Icon name={row.icon} size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ink">{row.label}</span>
              <span className="block truncate text-[11.5px] text-muted">{row.description}</span>
            </span>
            <Icon name="chevron" size={17} className="text-muted" />
          </Link>
        ))}
      </div>

      <div className="mt-4 px-4">
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-white">
              <Icon name="chat" size={19} />
            </span>
            <div>
              <p className="text-[14px] font-bold text-ink">مرسال</p>
              <p className="text-[11.5px] text-muted">الإصدار 1.0 · يعمل بالعربية الكاملة</p>
            </div>
          </div>
          <p className="mt-3 text-[11.5px] leading-6 text-muted">
            مرسال تطبيق تواصل اجتماعي للمحادثات والحالات والمجموعات والمكالمات، مع خيارات خصوصية
            وأمان وتخزين ونسخ احتياطي تُدار من حسابك.
          </p>
          <p className="mt-1.5 text-[11px] text-muted">
            حالة الخصوصية الحالية: {settings?.show_online ? 'الظهور متصل' : 'الظهور مخفي'} ·{' '}
            {settings?.read_receipts ? 'إشعارات القراءة مفعّلة' : 'إشعارات القراءة متوقفة'}
          </p>
        </div>
      </div>

      <div className="mt-4 px-4">
        <button type="button" className="btn-danger w-full" onClick={logout}>
          <Icon name="logout" size={17} />
          تسجيل الخروج
        </button>
      </div>
    </div>
  )
}
