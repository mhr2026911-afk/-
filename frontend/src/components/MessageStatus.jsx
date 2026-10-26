import Icon from './Icons'

export default function MessageStatus({ status = 'sent' }) {
  if (status === 'read') {
    return (
      <span className="inline-flex text-brand" title="تمت القراءة" aria-label="تمت القراءة">
        <Icon name="checks" size={16} strokeWidth={2.4} />
      </span>
    )
  }
  if (status === 'delivered') {
    return (
      <span className="inline-flex text-muted" title="تم الاستلام" aria-label="تم الاستلام">
        <Icon name="checks" size={16} strokeWidth={2.2} />
      </span>
    )
  }
  return (
    <span className="inline-flex text-muted" title="تم الإرسال" aria-label="تم الإرسال">
      <Icon name="check" size={15} strokeWidth={2.2} />
    </span>
  )
}
