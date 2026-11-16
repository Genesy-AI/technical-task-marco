import { createAstraDialer } from './astraDialer'
import { providerConfig } from './config'
import { createNimbusLookup } from './nimbusLookup'
import { createOrionConnect } from './orionConnect'
import { PROVIDER_TIMEOUTS_MS } from './timeouts'
import { PhoneProvider, PhoneProviderId } from './types'

export * from './types'

const { baseUrl } = providerConfig

export const phoneProviders: Readonly<Record<PhoneProviderId, PhoneProvider>> = {
  orionConnect: createOrionConnect({
    baseUrl,
    apiKey: providerConfig.orionConnectApiKey,
    timeoutMs: PROVIDER_TIMEOUTS_MS.orionConnect.request,
  }),
  astraDialer: createAstraDialer({
    baseUrl,
    apiKey: providerConfig.astraDialerApiKey,
    timeoutMs: PROVIDER_TIMEOUTS_MS.astraDialer.request,
  }),
  nimbusLookup: createNimbusLookup({
    baseUrl,
    apiKey: providerConfig.nimbusLookupApiKey,
    timeoutMs: PROVIDER_TIMEOUTS_MS.nimbusLookup.request,
  }),
}
