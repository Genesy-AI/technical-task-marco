import { ApplicationFailure } from '@temporalio/client'
import { describe, expect, it } from 'vitest'
import { ProviderHttpError, ProviderResponseError } from '../../providers/types'
import { toActivityError } from './providerFailure'

describe('toActivityError', () => {
  it.each([400, 401, 403, 404])('makes %i non-retryable', (status) => {
    const out = toActivityError(new ProviderHttpError('astraDialer', status, 'nope'))
    expect(out).toBeInstanceOf(ApplicationFailure)
    expect((out as ApplicationFailure).nonRetryable).toBe(true)
    expect((out as ApplicationFailure).type).toBe('ProviderClientError')
  })

  it.each([500, 502, 408, 429])('keeps %i retryable', (status) => {
    const out = toActivityError(new ProviderHttpError('orionConnect', status, 'boom'))
    expect(out).toBeInstanceOf(ApplicationFailure)
    expect((out as ApplicationFailure).nonRetryable).toBe(false)
    expect((out as ApplicationFailure).type).toBe('ProviderServerError')
  })

  it('makes malformed responses non-retryable', () => {
    const out = toActivityError(new ProviderResponseError('nimbusLookup', 'bad shape'))
    expect((out as ApplicationFailure).nonRetryable).toBe(true)
    expect((out as ApplicationFailure).type).toBe('ProviderInvalidResponse')
  })

  it('passes other errors (timeouts, network) through unchanged so Temporal retries them', () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError')
    expect(toActivityError(timeout)).toBe(timeout)
  })
})
