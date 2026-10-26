import test from 'node:test'
import assert from 'node:assert/strict'
import {
  avatarColor,
  formatBytes,
  formatCallDuration,
  formatDuration,
  formatLastSeen,
  initials,
  messagePreview,
  parseDate,
} from './format.js'

test('parseDate rejects empty and malformed values', () => {
  assert.equal(parseDate(''), null)
  assert.equal(parseDate('not-a-date'), null)
  assert.ok(parseDate('2026-01-02T10:00:00Z') instanceof Date)
})

test('formatDuration renders minutes and seconds', () => {
  assert.equal(formatDuration(0), '0:00')
  assert.equal(formatDuration(65), '1:05')
  assert.equal(formatDuration(-10), '0:00')
})

test('formatCallDuration switches to minutes then hours', () => {
  assert.equal(formatCallDuration(45), '45 ثانية')
  assert.equal(formatCallDuration(60), '1 دقيقة')
  assert.equal(formatCallDuration(90), '1 د 30 ث')
  assert.equal(formatCallDuration(3600), '1 ساعة')
})

test('formatBytes picks a readable unit', () => {
  assert.equal(formatBytes(0), '0 بايت')
  assert.equal(formatBytes(2048), '2.0 ك.ب')
})

test('initials falls back to the phone tail', () => {
  assert.equal(initials('', '+966500000001'), '01')
  assert.equal(initials('عبدالله السالم'), 'عا')
})

test('avatarColor is stable for the same seed', () => {
  assert.equal(avatarColor('user-1'), avatarColor('user-1'))
  assert.match(avatarColor('user-1'), /^bg-/)
})

test('messagePreview labels non-text messages', () => {
  assert.equal(messagePreview(null), '')
  assert.equal(messagePreview({ kind: 'text', body: 'مرحبا' }), 'مرحبا')
  assert.equal(messagePreview({ kind: 'image' }), '📷 صورة')
  assert.equal(messagePreview({ kind: 'file', meta: { filename: 'a.pdf' } }), '📄 a.pdf')
})

test('formatLastSeen reflects presence', () => {
  assert.equal(formatLastSeen(null), '')
  assert.equal(formatLastSeen({ online: true }), 'متصل الآن')
  assert.equal(formatLastSeen({ online: false }), 'غير متصل')
})
