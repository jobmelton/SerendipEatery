import { createNotificationWorker } from './workers/notification.worker'

console.log('Starting SerendipEatery notification worker...')

const worker = createNotificationWorker()

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down worker...')
  await worker.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

console.log('Notification worker is running. Waiting for jobs...')
