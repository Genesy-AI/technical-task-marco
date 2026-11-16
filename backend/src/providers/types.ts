/** Lead data available to phone providers. Each adapter picks what it needs. */
export interface PhoneLookupInput {
  firstName: string
  lastName: string
  email: string
  jobTitle: string | null
}

export interface PhoneLookupResult {
  phone: string
  /** ISO 3166-1 alpha-2, when the provider returns a valid one. */
  countryCode: string | null
}

export type PhoneProviderId = 'orionConnect' | 'astraDialer' | 'nimbusLookup'

/**
 * Adapter pattern: every provider hides its own input mapping, auth and response shape
 * behind the same interface, so the workflow only sees an ordered fallback chain.
 */
export interface PhoneProvider {
  readonly id: PhoneProviderId
  /** False when the lead lacks the inputs this provider requires (the provider is skipped, not called). */
  canHandle(input: PhoneLookupInput): boolean
  /** Resolves to null when the provider has no phone for this lead. Throws on transport/HTTP/shape errors. */
  findPhone(input: PhoneLookupInput): Promise<PhoneLookupResult | null>
}

/** Non-2xx response from a provider. `status` lets callers decide retryable vs non-retryable. */
export class ProviderHttpError extends Error {
  constructor(
    readonly providerId: PhoneProviderId,
    readonly status: number,
    body: string
  ) {
    super(`${providerId} responded ${status}: ${body.slice(0, 200)}`)
    this.name = 'ProviderHttpError'
  }

  /** 4xx means our request is wrong (auth, missing input): retrying cannot fix it. 408/429 are transient. */
  get isRetryable(): boolean {
    return this.status >= 500 || this.status === 408 || this.status === 429
  }
}

/** 2xx response whose body does not match the provider's contract. Not retryable. */
export class ProviderResponseError extends Error {
  constructor(
    readonly providerId: PhoneProviderId,
    message: string
  ) {
    super(`${providerId} returned an unexpected response: ${message}`)
    this.name = 'ProviderResponseError'
  }
}
