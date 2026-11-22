import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createOfflineQueueItem,
  enqueueOfflineItem,
  getPendingOfflineItems,
  markOfflineItemStatus,
  pruneSyncedOfflineItems,
} from './offlineSyncQueue.ts'

test('offline sync queue enqueues, updates status, and prunes synced records cleanly', () => {
  const item1 = createOfflineQueueItem({
    id: 'op-1',
    type: 'fuel_log',
    endpoint: '/api/fleet/fuel',
    summary: '45L Diesel · ₹4,250 on TN 38 AB 1234',
    payload: { liters: 45, amountInr: 4250 },
    createdAt: '2026-11-21T10:00:00.000Z',
  })
  const item2 = createOfflineQueueItem({
    id: 'op-2',
    type: 'dvir_check',
    endpoint: '/api/fleet/inspections',
    summary: 'Pre-trip DVIR signed for TN 38 AB 1234',
    payload: { passed: true },
    createdAt: '2026-11-21T10:05:00.000Z',
  })

  let queue = enqueueOfflineItem([], item1)
  queue = enqueueOfflineItem(queue, item2)
  assert.equal(queue.length, 2)
  assert.equal(queue[0].id, 'op-2')

  // Duplicate idempotency key replaces cleanly without duplicating
  queue = enqueueOfflineItem(queue, { ...item1, summary: 'Updated 46L Diesel' })
  assert.equal(queue.length, 2)

  // Mark one synced, one failed
  queue = markOfflineItemStatus(queue, 'op-2', 'synced')
  queue = markOfflineItemStatus(queue, 'op-1', 'failed', 'Gateway timeout')

  const pending = getPendingOfflineItems(queue)
  assert.equal(pending.length, 1)
  assert.equal(pending[0].id, 'op-1')
  assert.equal(pending[0].errorMessage, 'Gateway timeout')

  const pruned = pruneSyncedOfflineItems(queue)
  assert.equal(pruned.length, 1)
  assert.equal(pruned[0].id, 'op-1')
})
