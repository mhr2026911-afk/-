import Icon from './Icons'

export function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
        checked ? 'bg-brand' : 'bg-line'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? 'right-0.5' : 'right-[22px]'
        }`}
      />
    </button>
  )
}

export function ToggleRow({ icon, title, description, checked, onChange, disabled }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      {icon ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
          <Icon name={icon} size={18} />
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-semibold text-ink">{title}</p>
        {description ? <p className="mt-0.5 text-[12px] leading-5 text-muted">{description}</p> : null}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} label={title} />
    </div>
  )
}

export function ChoiceRow({ title, description, value, options, onChange }) {
  return (
    <div className="px-4 py-3.5">
      <p className="text-[14.5px] font-semibold text-ink">{title}</p>
      {description ? <p className="mt-0.5 text-[12px] leading-5 text-muted">{description}</p> : null}
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange?.(option.value)}
            className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold transition ${
              value === option.value
                ? 'border-brand bg-brand text-white'
                : 'border-line bg-white text-ink/80 hover:bg-canvas'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Section({ title, children, action }) {
  return (
    <section className="mt-4">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-[12px] font-bold uppercase tracking-wide text-muted">{title}</h2>
        {action}
      </div>
      <div className="mt-2 overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        {children}
      </div>
    </section>
  )
}
