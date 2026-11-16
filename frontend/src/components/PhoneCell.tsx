import { FC } from 'react'
import { BadgeTone, phoneEnrichmentBadge } from '../utils/phoneEnrichment'

const TONE_CLASSES: Record<BadgeTone, string> = {
  gray: 'bg-gray-100 text-gray-700',
  blue: 'bg-blue-100 text-blue-800',
  green: 'bg-green-100 text-green-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
}

interface PhoneCellProps {
  phone: string | null
  status: string | null
  provider: string | null
}

/** Phone column: the number (if any) plus a badge with the enrichment status and provider. */
export const PhoneCell: FC<PhoneCellProps> = ({ phone, status, provider }) => {
  const badge = phoneEnrichmentBadge(status, provider)

  return (
    <div className="flex flex-col items-start gap-1">
      <span className="text-sm text-gray-900">{phone || '-'}</span>
      {badge && (
        <span
          title={badge.title}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TONE_CLASSES[badge.tone]}`}
        >
          {badge.inProgress && (
            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
          )}
          {badge.label}
        </span>
      )}
    </div>
  )
}
