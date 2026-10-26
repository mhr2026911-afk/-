const PIN_KEY = 'mersal_pin_hash'

export async function hashPin(pin) {
  const data = new TextEncoder().encode(`mersal:${pin}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function pinIsSet() {
  return Boolean(localStorage.getItem(PIN_KEY))
}

export function savePinHash(hash) {
  localStorage.setItem(PIN_KEY, hash)
}

export function clearPin() {
  localStorage.removeItem(PIN_KEY)
}

export function getPinHash() {
  return localStorage.getItem(PIN_KEY)
}
