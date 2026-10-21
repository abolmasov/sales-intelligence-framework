/**
 * Company Detection Utility
 * Consolidated logic for extracting company names from meetings
 *
 * Priority chain:
 * 1. Direct meeting.company field (if not fallback values)
 * 2. Linked deal company_name
 * 3. Linked account name
 * 4. Meeting title patterns (e.g., "Acme/Northstar Integrators", "Meeting with Acme")
 * 5. External attendee email domains
 * 6. External attendee names
 * 7. Default fallback: "Northstar Integrators"
 */

import type { CalendarMeeting, CalendarAttendee } from '../types/calendarMeeting';

// Domains that should not be used for company name extraction
const GENERIC_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'live.com',
  'msn.com',
  'mail.com',
  'protonmail.com',
];

// Fallback values that indicate company was not properly detected
const FALLBACK_VALUES = ['unknown', 'northstar', 'internal'];

const DEFAULT_COMPANY = 'Northstar Integrators';

/**
 * Extract company name from an email address domain
 */
export const extractCompanyFromEmail = (email: string): string | null => {
  if (!email || !email.includes('@')) return null;

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  // Skip generic email providers
  if (GENERIC_EMAIL_DOMAINS.includes(domain)) return null;

  // Extract company name from domain (e.g., "acme.com" -> "Acme")
  const companyPart = domain.split('.')[0];
  if (!companyPart || companyPart.length < 2) return null;

  return capitalizeFirst(companyPart);
};

/**
 * Extract domain from an email address (for account matching)
 */
export const extractDomainFromEmail = (email: string): string | null => {
  if (!email || !email.includes('@')) return null;

  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  // Skip generic email providers
  if (GENERIC_EMAIL_DOMAINS.includes(domain)) return null;

  return domain;
};

/**
 * Get first non-generic domain from attendees list
 */
export const getDomainFromAttendees = (attendees: CalendarAttendee[]): string | null => {
  if (!attendees?.length) return null;

  for (const attendee of attendees) {
    const domain = extractDomainFromEmail(attendee.email || '');
    if (domain) return domain;
  }

  return null;
};

/**
 * Capitalize first letter
 */
const capitalizeFirst = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Check if a value is a fallback/placeholder value
 */
const isFallbackValue = (value: string | null | undefined): boolean => {
  if (!value) return true;
  return FALLBACK_VALUES.includes(value.toLowerCase());
};

/**
 * Extract company name from meeting title using common patterns
 */
export const extractCompanyFromTitle = (title: string): string | null => {
  if (!title) return null;

  const patterns = [
    // "Acme/Northstar Integrators - Weekly Sync" or "Acme/Northstar library Discussion"
    /^([^/]+)\/(?:Northstar Integrators|Northstar library)/i,
    // "Acme - Northstar Integrators Meeting"
    /^([^-]+)\s*-\s*(?:Northstar Integrators|Northstar library)/i,
    // "Meeting with Acme Corp" or "Call with Acme"
    /^(?:Meeting|Call|Sync|Discussion)\s+with\s+([A-Z][a-zA-Z0-9\s&.]+?)(?:\s*[-/]|\s+(?:meeting|call|sync|discussion|team))/i,
    // "with Acme Corp" at start
    /^with\s+([A-Z][a-zA-Z0-9\s]+)/i,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match?.[1]) {
      const extracted = match[1].trim();
      // Skip generic terms
      const genericTerms = ['the', 'our', 'their', 'weekly', 'monthly', 'daily', 'internal'];
      if (extracted.length > 2 && !genericTerms.includes(extracted.toLowerCase())) {
        // Take first 2 words max to avoid grabbing too much
        return extracted.split(/\s+/).slice(0, 2).join(' ');
      }
    }
  }

  return null;
};

/**
 * Main function: Derive company name from a meeting using priority chain
 *
 * @param meeting - The calendar meeting object
 * @param options - Optional configuration
 * @returns The detected company name
 */
export const deriveCompanyFromMeeting = (
  meeting: CalendarMeeting,
  options?: {
    defaultValue?: string;
    skipFallbackCheck?: boolean;
  }
): string => {
  const defaultValue = options?.defaultValue ?? DEFAULT_COMPANY;
  const skipFallbackCheck = options?.skipFallbackCheck ?? false;

  // Priority 1: Direct company field (if not a fallback value)
  if (meeting.company && (skipFallbackCheck || !isFallbackValue(meeting.company))) {
    return meeting.company;
  }

  // Priority 2: Linked deal company_name
  if (meeting.deal?.company_name && !isFallbackValue(meeting.deal.company_name)) {
    return meeting.deal.company_name;
  }

  // Priority 3: Linked account name
  if (meeting.accountName && !isFallbackValue(meeting.accountName)) {
    return meeting.accountName;
  }

  // Priority 4: Extract from meeting title
  const titleCompany = extractCompanyFromTitle(meeting.title || '');
  if (titleCompany) {
    return titleCompany;
  }

  // Priority 5: External attendee email domains
  const externalAttendees = meeting.externalAttendees || [];
  for (const attendee of externalAttendees) {
    const company = extractCompanyFromEmail(attendee.email || '');
    if (company) return company;
  }

  // Priority 6: External attendee names (fallback)
  if (externalAttendees.length > 0) {
    const firstName = externalAttendees[0]?.name;
    if (firstName && !isFallbackValue(firstName)) {
      // First word might be company name in some cases
      const firstWord = firstName.split(' ')[0];
      if (firstWord && firstWord.length > 2) {
        return firstWord;
      }
    }
  }

  // Priority 7: Default fallback
  return defaultValue;
};

/**
 * Simple version: Derive company from attendees only
 * Used by calendarMeetingsStore for initial meeting normalization
 */
export const deriveCompanyFromAttendees = (externalAttendees: CalendarAttendee[]): string => {
  if (!externalAttendees?.length) {
    return DEFAULT_COMPANY;
  }

  // Try email domain first
  const firstEmail = externalAttendees[0].email || '';
  const company = extractCompanyFromEmail(firstEmail);
  if (company) return company;

  // Fallback to attendee name
  const attendeeName = externalAttendees[0]?.name;
  if (attendeeName && !isFallbackValue(attendeeName)) {
    return attendeeName;
  }

  return DEFAULT_COMPANY;
};

/**
 * Check if a meeting has a valid (non-fallback) company name
 */
export const hasValidCompanyName = (meeting: CalendarMeeting): boolean => {
  return !!(meeting.company && !isFallbackValue(meeting.company));
};

/**
 * Get all possible company names for a meeting (for matching/searching)
 */
export const getAllPossibleCompanyNames = (meeting: CalendarMeeting): string[] => {
  const names = new Set<string>();

  if (meeting.company && !isFallbackValue(meeting.company)) {
    names.add(meeting.company.toLowerCase());
  }

  if (meeting.deal?.company_name && !isFallbackValue(meeting.deal.company_name)) {
    names.add(meeting.deal.company_name.toLowerCase());
  }

  if (meeting.accountName && !isFallbackValue(meeting.accountName)) {
    names.add(meeting.accountName.toLowerCase());
  }

  const titleCompany = extractCompanyFromTitle(meeting.title || '');
  if (titleCompany) {
    names.add(titleCompany.toLowerCase());
  }

  const externalAttendees = meeting.externalAttendees || [];
  for (const attendee of externalAttendees) {
    const company = extractCompanyFromEmail(attendee.email || '');
    if (company) names.add(company.toLowerCase());
  }

  return Array.from(names);
};

/**
 * Account matching result
 */
export interface AccountMatchResult {
  accountId: string;
  accountName: string;
  matchType: 'domain' | 'name' | 'company';
  confidence: 'high' | 'medium' | 'low';
  domain?: string;
}

/**
 * Try to find a matching account for a meeting
 * Uses domain matching (high confidence) and name matching (medium confidence)
 */
export const findMatchingAccountForMeeting = (
  meeting: CalendarMeeting,
  accounts: Array<{ account_id: string; name: string; domain?: string | null }>
): AccountMatchResult | null => {
  if (!accounts.length) return null;

  // Already linked to an account
  if (meeting.accountId) return null;

  const externalAttendees = meeting.externalAttendees || [];

  // Priority 1: Match by email domain (high confidence)
  for (const attendee of externalAttendees) {
    const domain = extractDomainFromEmail(attendee.email || '');
    if (domain) {
      const matchedAccount = accounts.find(
        (acc) => acc.domain?.toLowerCase() === domain.toLowerCase()
      );
      if (matchedAccount) {
        return {
          accountId: matchedAccount.account_id,
          accountName: matchedAccount.name,
          matchType: 'domain',
          confidence: 'high',
          domain,
        };
      }
    }
  }

  // Priority 2: Match by company name derived from meeting
  const companyName = deriveCompanyFromMeeting(meeting);
  if (companyName && !isFallbackValue(companyName)) {
    const normalizedCompany = companyName.toLowerCase();
    const matchedAccount = accounts.find(
      (acc) => acc.name.toLowerCase() === normalizedCompany
    );
    if (matchedAccount) {
      return {
        accountId: matchedAccount.account_id,
        accountName: matchedAccount.name,
        matchType: 'name',
        confidence: 'medium',
      };
    }

    // Partial name match (account name contains company or vice versa)
    const partialMatch = accounts.find(
      (acc) =>
        acc.name.toLowerCase().includes(normalizedCompany) ||
        normalizedCompany.includes(acc.name.toLowerCase())
    );
    if (partialMatch) {
      return {
        accountId: partialMatch.account_id,
        accountName: partialMatch.name,
        matchType: 'company',
        confidence: 'low',
      };
    }
  }

  return null;
};
