export default function Brand({ size = 'md', tone = 'brand', withName = true }) {
  const box = size === 'lg' ? 'h-16 w-16 rounded-[1.4rem]' : 'h-10 w-10 rounded-xl'
  const glyph = size === 'lg' ? 34 : 22
  const colors =
    tone === 'light'
      ? 'bg-white/15 text-white ring-1 ring-white/30'
      : 'bg-brand text-white'

  return (
    <div className="flex items-center gap-3">
      <span className={`flex ${box} ${colors} items-center justify-center shadow-sm`}>
        <svg width={glyph} height={glyph} viewBox="0 0 32 32" fill="none" aria-hidden="true">
          <path
            d="M6 10.5h20v11H15.5L10 26v-4.5H6z"
            fill="currentColor"
            opacity="0.95"
          />
          <path d="M11 16h10" stroke="#0f6b57" strokeWidth="2" strokeLinecap="round" />
          <circle cx="22.5" cy="9" r="3.4" fill="#c9a24a" />
        </svg>
      </span>
      {withName ? (
        <div className="leading-tight">
          <p className={`font-extrabold ${size === 'lg' ? 'text-2xl' : 'text-lg'}`}>
            مرسال
          </p>
          <p className="text-[11px] font-medium text-muted">تواصل، حالات، ومكالمات</p>
        </div>
      ) : null}
    </div>
  )
}
