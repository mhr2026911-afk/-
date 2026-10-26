import Icon from './Icons'
import { avatarColor, initials } from '../lib/format'
import { mediaUrl } from '../lib/api'

const SIZES = {
  xs: 'h-8 w-8 text-[11px]',
  sm: 'h-10 w-10 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-24 w-24 text-2xl',
}

export default function Avatar({
  user,
  name,
  mediaId,
  size = 'md',
  online,
  className = '',
  rounded = 'full',
}) {
  const label = name ?? user?.name
  const phone = user?.phone
  const avatar = mediaId ?? user?.avatar_media_id
  const seed = user?.id || label || phone || 'مرسال'
  const shape = rounded === 'full' ? 'rounded-full' : 'rounded-2xl'

  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <span
        className={`flex ${SIZES[size]} ${shape} items-center justify-center overflow-hidden font-bold ${
          avatar ? 'bg-brand-soft' : avatarColor(seed)
        }`}
      >
        {avatar ? (
          <img
            src={mediaUrl(avatar)}
            alt={label || 'صورة الملف الشخصي'}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          (initials(label, phone) || <Icon name="user" size={18} />)
        )}
      </span>
      {online ? (
        <span className="absolute -bottom-0.5 -left-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
      ) : null}
    </span>
  )
}
