import { describe, expect, it } from 'vitest'
import { companyDomainFromEmail } from './emailDomain'

describe('companyDomainFromEmail', () => {
  it('returns the lowercased domain of a business email', () => {
    expect(companyDomainFromEmail('ada@acme.com')).toBe('acme.com')
    expect(companyDomainFromEmail('  Ada.Lovelace@Sub.Acme.CO.uk ')).toBe('sub.acme.co.uk')
  })

  it('returns null for free-mail domains', () => {
    expect(companyDomainFromEmail('someone@gmail.com')).toBeNull()
    expect(companyDomainFromEmail('someone@Yahoo.com')).toBeNull()
    expect(companyDomainFromEmail('someone@hotmail.com')).toBeNull()
  })

  it('returns null for placeholder domains like example.com', () => {
    expect(companyDomainFromEmail('john.doe@example.com')).toBeNull()
    expect(companyDomainFromEmail('john.doe@EXAMPLE.org')).toBeNull()
  })

  it('returns null for empty or malformed emails', () => {
    expect(companyDomainFromEmail('')).toBeNull()
    expect(companyDomainFromEmail(null)).toBeNull()
    expect(companyDomainFromEmail(undefined)).toBeNull()
    expect(companyDomainFromEmail('not-an-email')).toBeNull()
    expect(companyDomainFromEmail('ada@localhost')).toBeNull()
    expect(companyDomainFromEmail('a b@acme.com')).toBeNull()
  })
})
