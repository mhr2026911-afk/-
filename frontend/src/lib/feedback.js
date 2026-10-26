let context = null

function ensureContext() {
  if (!context) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null
    context = new AudioContextClass()
  }
  return context
}

/** Short, soft notification tone (no external asset needed). */
export function ping(kind = 'message') {
  const ctx = ensureContext()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})

  const now = ctx.currentTime
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(kind === 'call' ? 660 : 880, now)
  oscillator.frequency.exponentialRampToValueAtTime(
    kind === 'call' ? 520 : 1180,
    now + 0.16,
  )
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.05, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(now)
  oscillator.stop(now + 0.26)
}

export function vibrate(pattern = 40) {
  if (navigator.vibrate) navigator.vibrate(pattern)
}
