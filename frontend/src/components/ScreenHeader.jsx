import { useNavigate } from 'react-router-dom'
import Icon from './Icons'

export default function ScreenHeader({ title, subtitle, onBack, right, tone = 'light', bottom }) {
  const navigate = useNavigate()
  const light = tone === 'light'

  return (
    <header
      className={`sticky top-0 z-20 ${
        light
          ? 'border-b border-line/70 bg-white/95 text-ink backdrop-blur'
          : 'bg-brand text-white'
      }`}
    >
      <div className="flex items-center gap-2 px-2 py-2.5">
        {onBack ? (
          <button
            type="button"
            onClick={() => (typeof onBack === 'function' ? onBack() : navigate(-1))}
            className={`icon-btn ${light ? '' : 'text-white hover:bg-white/10'}`}
            aria-label="رجوع"
          >
            <Icon name="back" size={22} />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-bold leading-tight">{title}</h1>
          {subtitle ? (
            <p className={`truncate text-[12px] ${light ? 'text-muted' : 'text-white/75'}`}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {right ? <div className="flex items-center gap-1">{right}</div> : null}
      </div>
      {bottom}
    </header>
  )
}
