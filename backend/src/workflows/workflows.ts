import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'

// Email verification providers (SMTP checks) can take 10-30s, so allow 30s per attempt.
// Retries are bounded so a hung provider fails the workflow (worst case ~93s)
// instead of retrying forever under Temporal's default unlimited retry policy.
const { verifyEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: '30 seconds',
  retry: {
    maximumAttempts: 3,
    initialInterval: '1 second',
    backoffCoefficient: 2,
  },
})

export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}
