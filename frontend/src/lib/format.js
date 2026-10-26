const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export function parseDate(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatClock(value) {
  const date = parseDate(value)
  if (!date) return ''
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const suffix = hours >= 12 ? 'م' : 'ص'
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${suffix}`
}

function startOfDay(date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

export function formatDay(value) {
  const date = parseDate(value)
  if (!date) return ''
  const today = startOfDay(new Date())
  const day = startOfDay(date)
  const diff = Math.round((today - day) / 86400000)
  if (diff === 0) return 'اليوم'
  if (diff === 1) return 'أمس'
  if (diff > 1 && diff < 7) return AR_DAYS[date.getDay()]
  return date.toLocaleDateString('ar', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatRelative(value) {
  const date = parseDate(value)
  if (!date) return ''
  const diff = Date.now() - date.getTime()
  if (diff < 45000) return 'الآن'
  if (diff < 3600000) return `قبل ${Math.floor(diff / 60000)} د`
  const today = startOfDay(new Date())
  if (date >= today) return formatClock(value)
  const day = startOfDay(date)
  const days = Math.round((today - day) / 86400000)
  if (days === 1) return 'أمس'
  if (days < 7) return AR_DAYS[date.getDay()]
  return date.toLocaleDateString('ar', { day: 'numeric', month: 'short' })
}

export function formatLastSeen(user) {
  if (!user) return ''
  if (user.online) return 'متصل الآن'
  if (user.last_seen_at) return `آخر ظهور ${formatRelative(user.last_seen_at)}`
  return 'غير متصل'
}

export function formatDuration(seconds = 0) {
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${rest.toString().padStart(2, '0')}`
}

export function formatCallDuration(seconds = 0) {
  const total = Math.max(0, Math.round(seconds))
  if (total < 60) return `${total} ثانية`
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  if (minutes < 60) return rest ? `${minutes} د ${rest} ث` : `${minutes} دقيقة`
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes ? `${hours} س ${restMinutes} د` : `${hours} ساعة`
}

export function formatBytes(bytes = 0) {
  if (!bytes) return '0 بايت'
  const units = ['بايت', 'ك.ب', 'م.ب', 'ج.ب']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function initials(name, phone) {
  const source = (name || '').trim()
  if (!source) return (phone || '؟').slice(-2)
  const parts = source.split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2)
  return `${parts[0][0]}${parts[1][0]}`
}

const AVATAR_COLORS = [
  'bg-brand text-white',
  'bg-emerald-100 text-emerald-800',
  'bg-amber-100 text-amber-800',
  'bg-rose-100 text-rose-800',
  'bg-sky-100 text-sky-800',
  'bg-violet-100 text-violet-800',
]

export function avatarColor(seed = '') {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 997
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export function messagePreview(message) {
  if (!message) return ''
  switch (message.kind) {
    case 'image':
      return '📷 صورة'
    case 'video':
      return '🎬 فيديو'
    case 'audio':
      return '🎙️ رسالة صوتية'
    case 'file':
      return `📄 ${message.meta?.filename || 'ملف'}`
    case 'location':
      return '📍 موقع'
    case 'system':
      return message.body
    default:
      return message.body
  }
}
