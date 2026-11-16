import { Client, Connection } from '@temporalio/client'

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'localhost:7233'
export const TASK_QUEUE = 'myQueue'

let clientPromise: Promise<Client> | undefined

/**
 * Lazily created, shared Temporal client (one connection per process instead of one per request).
 * A failed connection is not cached, so the next request retries. connectTimeout bounds how long
 * an HTTP request can wait when the Temporal server is down.
 */
export function getTemporalClient(): Promise<Client> {
  clientPromise ??= Connection.connect({ address: TEMPORAL_ADDRESS, connectTimeout: '5 seconds' })
    .then((connection) => new Client({ connection, namespace: 'default' }))
    .catch((err) => {
      clientPromise = undefined
      throw err
    })
  return clientPromise
}
