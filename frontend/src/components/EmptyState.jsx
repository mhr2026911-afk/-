import Icon from './Icons'

export default function EmptyState({ icon = 'chat', title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-14 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft text-brand">
        <Icon name={icon} size={28} />
      </span>
      <p className="text-[15px] font-bold text-ink">{title}</p>
      {description ? (
        <p className="mt-1.5 text-[13px] leading-6 text-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}
