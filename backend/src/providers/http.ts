import { PhoneProviderId, ProviderHttpError, ProviderResponseError } from './types'

export interface PostJsonOptions {
  providerId: PhoneProviderId
  headers?: Record<string, string>
  timeoutMs: number
}

/**
 * POSTs JSON and returns the parsed body. Aborts after `timeoutMs` (AbortSignal.timeout),
 * throws ProviderHttpError on non-2xx and ProviderResponseError on a non-JSON body.
 */
export async function postJson(url: string, body: unknown, options: PostJsonOptions): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeoutMs),
  })

  const text = await res.text()
  if (!res.ok) {
    throw new ProviderHttpError(options.providerId, res.status, text)
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new ProviderResponseError(options.providerId, `body is not JSON: ${text.slice(0, 100)}`)
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Normalizes a provider phone value: non-empty string or finite number -> trimmed string; null/undefined/"" -> null. */
export function toPhoneString(value: unknown, providerId: PhoneProviderId, field: string): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string') return value.trim() || null
  throw new ProviderResponseError(providerId, `${field} has unexpected type ${typeof value}`)
}
