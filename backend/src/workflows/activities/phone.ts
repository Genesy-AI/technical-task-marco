import { ApplicationFailure } from '@temporalio/client'
import { prisma } from '../../db/prisma'
import { phoneProviders } from '../../providers'
import type { PhoneLookupInput, PhoneProviderId } from '../../providers/types'
import type { PhoneEnrichmentStatus, ProviderActivityResult } from '../phoneEnrichment'
import { toActivityError } from './providerFailure'

/** Loads the inputs the providers need. A missing lead cannot be fixed by retrying. */
export async function loadLeadForPhoneEnrichment(leadId: number): Promise<PhoneLookupInput> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } })
  if (!lead) {
    throw ApplicationFailure.nonRetryable(`Lead ${leadId} not found`, 'LeadNotFound')
  }
  return { firstName: lead.firstName, lastName: lead.lastName, email: lead.email, jobTitle: lead.jobTitle }
}

export interface PhoneEnrichmentPatch {
  status: PhoneEnrichmentStatus
  provider: PhoneProviderId | null
  phone?: string
}

/** Persists progress so the UI can poll it. updateMany: a lead deleted mid-workflow is a no-op, not an error. */
export async function updatePhoneEnrichment(leadId: number, patch: PhoneEnrichmentPatch): Promise<void> {
  await prisma.lead.updateMany({
    where: { id: leadId },
    data: {
      phoneEnrichmentStatus: patch.status,
      phoneEnrichmentProvider: patch.provider,
      ...(patch.phone !== undefined && { phone: patch.phone }),
    },
  })
}

async function runProvider(providerId: PhoneProviderId, input: PhoneLookupInput): Promise<ProviderActivityResult> {
  const provider = phoneProviders[providerId]
  if (!provider.canHandle(input)) return { outcome: 'SKIPPED' }

  try {
    const result = await provider.findPhone(input)
    return result ? { outcome: 'FOUND', ...result } : { outcome: 'NO_DATA' }
  } catch (err) {
    throw toActivityError(err)
  }
}

// One named activity per provider: each gets its own timeout in the workflow and its own row in the Temporal UI.
export const findPhoneOrionConnect = (input: PhoneLookupInput) => runProvider('orionConnect', input)
export const findPhoneAstraDialer = (input: PhoneLookupInput) => runProvider('astraDialer', input)
export const findPhoneNimbusLookup = (input: PhoneLookupInput) => runProvider('nimbusLookup', input)
