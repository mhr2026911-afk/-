import test from 'node:test'
import assert from 'node:assert/strict'
import { hashPin } from './pin.js'

test('hashPin returns a deterministic sha-256 digest', async () => {
  const digest = await hashPin('1234')
  assert.match(digest, /^[0-9a-f]{64}$/)
  assert.equal(await hashPin('1234'), digest)
  assert.notEqual(await hashPin('4321'), digest)
})
