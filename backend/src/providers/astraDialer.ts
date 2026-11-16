import { isRecord, postJson, toPhoneString } from './http'
import { PhoneProvider, ProviderResponseError } from './types'

export interface AstraDialerConfig {
  baseUrl: string
  apiKey: string
  timeoutMs: number
}

/**
 * Astra Dialer: worst data, fastest (0.2-1.2s).
 * Request `{ email }`, header `apiKey`, response `{ phoneNmbr: string | null | undefined }`.
 */
export function createAstraDialer(config: AstraDialerConfig): PhoneProvider {
  return {
    id: 'astraDialer',
    canHandle: (input) => Boolean(input.email?.trim()),
    async findPhone(input) {
      const body = await postJson(
        `${config.baseUrl}/astraDialer`,
        { email: input.email.trim() },
        { providerId: 'astraDialer', headers: { apiKey: config.apiKey }, timeoutMs: config.timeoutMs }
      )
      if (!isRecord(body)) throw new ProviderResponseError('astraDialer', 'body is not an object')

      const phone = toPhoneString(body.phoneNmbr, 'astraDialer', 'phoneNmbr')
      return phone ? { phone, countryCode: null } : null
    },
  }
}
