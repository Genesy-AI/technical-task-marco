/**
 * Provider endpoints and credentials, read from the environment.
 * Fallbacks are the sandbox keys published in the README for this exercise only;
 * real keys must come from a secrets manager (see NOTES.md).
 * `||` (not `??`) so an empty value copied from .env.sample also falls back.
 */
export const providerConfig = {
  baseUrl: process.env.PHONE_PROVIDERS_BASE_URL || 'https://api.enginy.ai/api/tmp',
  orionConnectApiKey: process.env.ORION_CONNECT_API_KEY || 'mySecretKey123',
  astraDialerApiKey: process.env.ASTRA_DIALER_API_KEY || '1234jhgf',
  nimbusLookupApiKey: process.env.NIMBUS_LOOKUP_API_KEY || '000099998888',
}
