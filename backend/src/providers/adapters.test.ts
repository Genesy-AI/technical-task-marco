import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAstraDialer } from './astraDialer'
import { createNimbusLookup } from './nimbusLookup'
import { createOrionConnect } from './orionConnect'
import { PhoneLookupInput, ProviderHttpError, ProviderResponseError } from './types'

const BASE = 'https://providers.test'
const cfg = { baseUrl: BASE, apiKey: 'k', timeoutMs: 1000 }

const lead = (overrides: Partial<PhoneLookupInput> = {}): PhoneLookupInput => ({
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@acme.com',
  jobTitle: 'CTO',
  ...overrides,
})

const fetchMock = vi.fn()
const respond = (status: number, body: unknown) =>
  fetchMock.mockResolvedValueOnce(
    new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
  )
const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
  return { url, headers: init.headers as Record<string, string>, body: JSON.parse(init.body as string) }
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('Orion Connect adapter', () => {
  const orion = createOrionConnect(cfg)

  it('can only handle leads with a business email (companyWebsite is required)', () => {
    expect(orion.canHandle(lead())).toBe(true)
    expect(orion.canHandle(lead({ email: 'ada@gmail.com' }))).toBe(false)
    expect(orion.canHandle(lead({ email: 'john.doe@example.com' }))).toBe(false)
  })

  it('sends fullName + derived companyWebsite with the x-auth-me header', async () => {
    respond(200, { phone: '1996454697' })
    await expect(orion.findPhone(lead())).resolves.toEqual({ phone: '1996454697', countryCode: null })
    const call = lastCall()
    expect(call.url).toBe(`${BASE}/orionConnect`)
    expect(call.headers['x-auth-me']).toBe('k')
    expect(call.body).toEqual({ fullName: 'Ada Lovelace', companyWebsite: 'acme.com' })
  })

  it('returns null when phone is null or empty', async () => {
    respond(200, { phone: null })
    await expect(orion.findPhone(lead())).resolves.toBeNull()
    respond(200, { phone: '  ' })
    await expect(orion.findPhone(lead())).resolves.toBeNull()
  })

  it('throws a retryable ProviderHttpError on 500', async () => {
    respond(500, { message: 'Internal server error' })
    const err = await orion.findPhone(lead()).catch((e) => e)
    expect(err).toBeInstanceOf(ProviderHttpError)
    expect(err.status).toBe(500)
    expect(err.isRetryable).toBe(true)
  })
})

describe('Astra Dialer adapter', () => {
  const astra = createAstraDialer(cfg)

  it('sends the email with the apiKey header and reads phoneNmbr', async () => {
    respond(200, { phoneNmbr: '9985337678' })
    await expect(astra.findPhone(lead())).resolves.toEqual({ phone: '9985337678', countryCode: null })
    const call = lastCall()
    expect(call.url).toBe(`${BASE}/astraDialer`)
    expect(call.headers.apiKey).toBe('k')
    expect(call.body).toEqual({ email: 'ada@acme.com' })
  })

  it('returns null for phoneNmbr null or missing', async () => {
    respond(200, { phoneNmbr: null })
    await expect(astra.findPhone(lead())).resolves.toBeNull()
    respond(200, {})
    await expect(astra.findPhone(lead())).resolves.toBeNull()
  })

  it('throws a non-retryable ProviderHttpError on 401', async () => {
    respond(401, 'Unauthorized')
    const err = await astra.findPhone(lead()).catch((e) => e)
    expect(err).toBeInstanceOf(ProviderHttpError)
    expect(err.isRetryable).toBe(false)
  })

  it('treats 429 (future rate limits) as retryable', async () => {
    respond(429, 'Too Many Requests')
    const err = await astra.findPhone(lead()).catch((e) => e)
    expect(err.isRetryable).toBe(true)
  })
})

describe('Nimbus Lookup adapter', () => {
  const nimbus = createNimbusLookup(cfg)

  it('requires email and jobTitle', () => {
    expect(nimbus.canHandle(lead())).toBe(true)
    expect(nimbus.canHandle(lead({ jobTitle: null }))).toBe(false)
    expect(nimbus.canHandle(lead({ jobTitle: '  ' }))).toBe(false)
  })

  it('sends email + jobTitle with the api query param', async () => {
    respond(200, { phoneNmbr: 9751566516, countryCode: 'ES' })
    await nimbus.findPhone(lead())
    const call = lastCall()
    expect(call.url).toBe(`${BASE}/numbusLookup?api=k`)
    expect(call.body).toEqual({ email: 'ada@acme.com', jobTitle: 'CTO' })
  })

  it('reads numeric phoneNmbr (real API), stringifies it and keeps the ISO country code', async () => {
    respond(200, { phoneNmbr: 9751566516, countryCode: 'ES' })
    await expect(nimbus.findPhone(lead())).resolves.toEqual({ phone: '9751566516', countryCode: 'ES' })
  })

  it('falls back to the documented `number` field', async () => {
    respond(200, { number: 3811985286, countryCode: 'es' })
    await expect(nimbus.findPhone(lead())).resolves.toEqual({ phone: '3811985286', countryCode: 'ES' })
  })

  it('stores an invalid country code as null without losing the phone', async () => {
    respond(200, { phoneNmbr: 123, countryCode: 'XXX' })
    await expect(nimbus.findPhone(lead())).resolves.toEqual({ phone: '123', countryCode: null })
  })

  it('returns null when no phone is present', async () => {
    respond(200, { phoneNmbr: null, countryCode: 'ES' })
    await expect(nimbus.findPhone(lead())).resolves.toBeNull()
  })

  it('throws ProviderResponseError for an unexpected phone type or non-JSON body', async () => {
    respond(200, { phoneNmbr: { nested: true } })
    await expect(nimbus.findPhone(lead())).rejects.toBeInstanceOf(ProviderResponseError)
    respond(200, '<html>oops</html>')
    await expect(nimbus.findPhone(lead())).rejects.toBeInstanceOf(ProviderResponseError)
  })
})
