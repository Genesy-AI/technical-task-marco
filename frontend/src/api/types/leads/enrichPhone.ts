export type LeadsEnrichPhoneInput = {
  leadIds: number[]
}

type LeadRef = { leadId: number; leadName: string }

/** 202 response: workflows run in the background; progress is read from each lead's phoneEnrichmentStatus. */
export type LeadsEnrichPhoneOutput = {
  started: LeadRef[]
  /** Leads that already have a phone (not sent to providers). */
  skipped: LeadRef[]
  /** Leads with an enrichment workflow already running. */
  alreadyRunning: LeadRef[]
  errors: Array<LeadRef & { error: string }>
}
