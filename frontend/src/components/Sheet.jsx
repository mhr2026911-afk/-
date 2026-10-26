import { useEffect } from 'react'
import Icon from './Icons'

export default function Sheet({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-brand-deep/45 backdrop-blur-[2px] animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-[480px] animate-slide-up rounded-t-3xl bg-white pb-6 shadow-float"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'نافذة'}
      >
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <span className="mx-auto h-1.5 w-10 rounded-full bg-line" />
        </div>
        <div className="flex items-center gap-2 px-4 pb-2">
          <h2 className="flex-1 text-base font-bold text-ink">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="إغلاق">
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4">{children}</div>
        {footer ? <div className="px-4 pt-3">{footer}</div> : null}
      </div>
    </div>
  )
}
