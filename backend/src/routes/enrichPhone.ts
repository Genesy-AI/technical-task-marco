import { WorkflowExecutionAlreadyStartedError } from '@temporalio/client'
import { Request, Response, Router } from 'express'
import { prisma } from '../db/prisma'
import { getTemporalClient, TASK_QUEUE } from '../temporal/client'
import { enrichPhoneWorkflow } from '../workflows/enrichPhone'
import { isActivePhoneEnrichmentStatus, PhoneEnrichmentStatus } from '../workflows/phoneEnrichment'

/** Idempotency key: at most one running enrichment per lead (ADR-003). */
export const enrichPhoneWorkflowId = (leadId: number) => `enrich-phone-${leadId}`

/** Returns unique positive integer ids, or null when the input is not a non-empty array of them. */
export function parseLeadIds(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const ids = value.map((v) => Number(v))
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) return null
  return [...new Set(ids)]
}

type LeadRef = { leadId: number; leadName: string }

export const enrichPhoneRouter = Router()

/**
 * Starts one enrichPhoneWorkflow per lead and returns immediately (202). Progress is persisted on the
 * lead row by the workflow and polled by the UI; the HTTP request never waits for providers.
 */
enrichPhoneRouter.post('/leads/enrich-phone', async (req: Request, res: Response) => {
  const leadIds = parseLeadIds(req.body?.leadIds)
  if (!leadIds) {
    return res.status(400).json({ error: 'leadIds must be a non-empty array of positive integers' })
  }

  try {
    const leads = await prisma.lead.findMany({
      where: { id: { in: leadIds } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        phoneEnrichmentStatus: true,
        phoneEnrichmentProvider: true,
      },
    })
    if (leads.length === 0) {
      return res.status(404).json({ error: 'No leads found with the provided IDs' })
    }

    const ref = (l: (typeof leads)[number]): LeadRef => ({
      leadId: l.id,
      leadName: `${l.firstName} ${l.lastName}`.trim(),
    })
    // Leads that already have a phone are not sent to (paid) providers.
    const skipped = leads.filter((l) => l.phone).map(ref)
    const toStart = leads.filter((l) => !l.phone)

    if (toStart.length === 0) {
      return res.status(202).json({ started: [], skipped, alreadyRunning: [], errors: [] })
    }

    let client
    try {
      client = await getTemporalClient()
    } catch (err) {
      console.error('Temporal unavailable:', err)
      return res.status(503).json({ error: 'Phone enrichment is temporarily unavailable. Please try again later.' })
    }

    // Mark PENDING before starting so the UI shows progress immediately. Leads already PENDING/IN_PROGRESS
    // are left alone (a workflow may be running). `notIn` does not match NULL in SQL, hence the OR.
    await prisma.lead.updateMany({
      where: {
        id: { in: toStart.map((l) => l.id) },
        OR: [
          { phoneEnrichmentStatus: null },
          { phoneEnrichmentStatus: { notIn: [PhoneEnrichmentStatus.PENDING, PhoneEnrichmentStatus.IN_PROGRESS] } },
        ],
      },
      data: { phoneEnrichmentStatus: PhoneEnrichmentStatus.PENDING, phoneEnrichmentProvider: null },
    })

    const settled = await Promise.allSettled(
      toStart.map((lead) =>
        client.workflow.start(enrichPhoneWorkflow, {
          taskQueue: TASK_QUEUE,
          // Default reuse policy (ALLOW_DUPLICATE): a lead can be re-enriched once its previous run has closed.
          workflowId: enrichPhoneWorkflowId(lead.id),
          args: [lead.id],
          // No workflowExecutionTimeout on purpose: a server-side timeout ends the run without executing
          // workflow code, so the lead would stay PENDING forever. Per-activity timeouts + bounded retries
          // already cap the provider chain at ~72s.
        })
      )
    )

    const started: LeadRef[] = []
    const alreadyRunning: LeadRef[] = []
    const errors: Array<LeadRef & { error: string }> = []

    settled.forEach((outcome, i) => {
      const lead = toStart[i]
      if (outcome.status === 'fulfilled') started.push(ref(lead))
      else if (outcome.reason instanceof WorkflowExecutionAlreadyStartedError) alreadyRunning.push(ref(lead))
      else {
        console.error(`Failed to start phone enrichment for lead ${lead.id}:`, outcome.reason)
        errors.push({ ...ref(lead), error: 'Could not start phone enrichment' })
      }
    })

    // Race: the previous run may have written its final status but not closed yet, so this request flipped the
    // lead to PENDING and then got AlreadyStarted. Nobody would clear that PENDING: restore what we overwrote.
    // Conditional on PENDING so a newer write by the running workflow is never clobbered.
    const flippedToPending = new Map(
      toStart.filter((l) => !isActivePhoneEnrichmentStatus(l.phoneEnrichmentStatus)).map((l) => [l.id, l])
    )
    for (const { leadId } of alreadyRunning) {
      const previous = flippedToPending.get(leadId)
      if (!previous) continue
      await prisma.lead.updateMany({
        where: { id: leadId, phoneEnrichmentStatus: PhoneEnrichmentStatus.PENDING },
        data: {
          phoneEnrichmentStatus: previous.phoneEnrichmentStatus,
          phoneEnrichmentProvider: previous.phoneEnrichmentProvider,
        },
      })
    }

    // Don't leave leads PENDING forever when their workflow never started.
    if (errors.length > 0) {
      await prisma.lead.updateMany({
        where: { id: { in: errors.map((e) => e.leadId) } },
        data: { phoneEnrichmentStatus: PhoneEnrichmentStatus.FAILED, phoneEnrichmentProvider: null },
      })
    }

    res.status(202).json({ started, skipped, alreadyRunning, errors })
  } catch (error) {
    console.error('Error starting phone enrichment:', error)
    res.status(500).json({ error: 'Failed to start phone enrichment' })
  }
})
