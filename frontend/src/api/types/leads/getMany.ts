export type LeadsGetManyInput = undefined

export type LeadsGetManyOutput = {
  id: number
  createdAt: string
  updatedAt: string
  firstName: string
  lastName: string | null
  email: string | null
  jobTitle: string | null
  countryCode: string | null
  companyName: string | null
  message: string | null
  emailVerified: boolean | null
  phone: string | null
  yearsAtCompany: number | null
  linkedinUrl: string | null
  /** PENDING | IN_PROGRESS | FOUND | NOT_FOUND | FAILED, or null if never enriched. */
  phoneEnrichmentStatus: string | null
  /** Provider currently being tried (IN_PROGRESS) or that found the phone (FOUND). */
  phoneEnrichmentProvider: string | null
}[]
