import { test } from '@japa/runner'

test.group('test harness', () => {
  test('runs unit specs', ({ assert }) => {
    assert.equal(1 + 1, 2)
  })
})
