/**
 * Free-mail and placeholder domains: their domain says nothing about the lead's company.
 * example.com/org/net are reserved placeholders (RFC 2606).
 */
const NON_COMPANY_DOMAINS: ReadonlySet<string> = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.es',
  'yahoo.co.uk',
  'hotmail.com',
  'hotmail.es',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'gmx.de',
  'mail.com',
  'yandex.com',
  'zoho.com',
  'example.com',
  'example.org',
  'example.net',
])

/**
 * Best-effort company website derived from a business email (ada@acme.com -> acme.com).
 * Returns null for malformed emails and free-mail/placeholder domains. Heuristic: the email
 * domain may differ from the company's website (ADR-003).
 */
export function companyDomainFromEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const match = /^[^\s@]+@([^\s@]+\.[^\s@]+)$/.exec(email.trim())
  if (!match) return null
  const domain = match[1].toLowerCase()
  return NON_COMPANY_DOMAINS.has(domain) ? null : domain
}
