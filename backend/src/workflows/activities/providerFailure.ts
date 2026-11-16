import { ApplicationFailure } from '@temporalio/client'
import { ProviderHttpError, ProviderResponseError } from '../../providers/types'

/**
 * Maps a provider error to what Temporal should do with it:
 * - 4xx (except 408/429) and malformed responses: non-retryable, retrying cannot fix them (fail fast).
 * - 5xx/408/429: retryable ApplicationFailure with a clear type for the Temporal UI.
 * - anything else (timeouts, network): returned as-is, retryable by default.
 */
export function toActivityError(err: unknown): unknown {
  if (err instanceof ProviderHttpError) {
    return err.isRetryable
      ? ApplicationFailure.retryable(err.message, 'ProviderServerError', { status: err.status })
      : ApplicationFailure.nonRetryable(err.message, 'ProviderClientError', { status: err.status })
  }
  if (err instanceof ProviderResponseError) {
    return ApplicationFailure.nonRetryable(err.message, 'ProviderInvalidResponse')
  }
  return err
}
