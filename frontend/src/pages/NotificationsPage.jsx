import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ScreenHeader from '../components/ScreenHeader'
import { Section, ToggleRow } from '../components/Settings'
import { useAuth } from '../lib/auth'

const ROWS = [
  {
    key: 'notify_messages',
    icon: 'chat',
    title: 'إشعارات الرسائل',
    description: 'تنبيه عند وصول رسالة جديدة في المحادثات الفردية.',
  },
  {
    key: 'notify_groups',
    icon: 'users',
    title: 'إشعارات المجموعات',
    description: 'تنبيه لرسائل المجموعات التي أنت عضو فيها.',
  },
  {
    key: 'notify_calls',
    icon: 'phone',
    title: 'إشعارات المكالمات',
    description: 'تنبيه للمكالمات الصوتية والمرئية الواردة.',
  },
  {
    key: 'notify_stories',
    icon: 'stories',
    title: 'إشعارات الحالات',
    description: 'تنبيه عند نشر حالة جديدة من جهات اتصالك.',
  },
]

const SOUND_ROWS = [
  {
    key: 'notify_sound',
    icon: 'speaker',
    title: 'نغمة الإشعار',
    description: 'تشغيل نغمة قصيرة عند وصول إشعار.',
  },
  {
    key: 'notify_vibration',
    icon: 'sparkle',
    title: 'الاهتزاز',
    description: 'اهتزاز الجهاز مع الإشعارات (على الأجهزة الداعمة).',
  },
  {
    key: 'notify_preview',
    icon: 'eye',
    title: 'معاينة نص الرسالة',
    description: 'إظهار نص الرسالة في قائمة المحادثات.',
  },
]

export default function NotificationsPage() {
  const { settings, updateSettings } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const change = async (key, value) => {
    setError('')
    try {
      await updateSettings({ [key]: value })
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="pb-10">
      <ScreenHeader
        title="الإشعارات"
        subtitle="اختر ما يصلك ومتى"
        onBack={() => navigate('/settings')}
      />
      <div className="px-4">
        {error ? (
          <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-[12px] font-medium text-danger">
            {error}
          </p>
        ) : null}

        <Section title="أنواع الإشعارات">
          {ROWS.map((row, index) => (
            <div key={row.key}>
              {index > 0 ? <div className="divider" /> : null}
              <ToggleRow
                icon={row.icon}
                title={row.title}
                description={row.description}
                checked={Boolean(settings?.[row.key])}
                onChange={(value) => change(row.key, value)}
              />
            </div>
          ))}
        </Section>

        <Section title="الصوت والتنبيه">
          {SOUND_ROWS.map((row, index) => (
            <div key={row.key}>
              {index > 0 ? <div className="divider" /> : null}
              <ToggleRow
                icon={row.icon}
                title={row.title}
                description={row.description}
                checked={Boolean(settings?.[row.key])}
                onChange={(value) => change(row.key, value)}
              />
            </div>
          ))}
        </Section>

        <p className="mt-4 px-2 text-[11px] leading-6 text-muted">
          تُطبَّق هذه الإعدادات على الإشعارات داخل التطبيق وعلى جهازك، وتُحفظ في حسابك لتنتقل معك.
        </p>
      </div>
    </div>
  )
}
