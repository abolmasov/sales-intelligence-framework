/**
 * ID Conversion Utilities for Microsoft Teams/Calendar meeting IDs
 *
 * Microsoft Graph API can return meeting identifiers in different formats:
 * - iCalUId: Can be hex-encoded or base64-encoded depending on the source
 * - onlineMeetingId: Teams meeting ID
 * - eventId: Calendar event ID
 *
 * This utility provides consistent conversion and expansion of IDs
 * to ensure reliable matching across different storage and lookup paths.
 */

/**
 * Convert a hex string to base64
 * @param hex - Hex-encoded string
 * @returns Base64 string or null if conversion fails
 */
export const hexToBase64 = (hex: string): string | null => {
  try {
    // Validate hex string
    if (!/^[0-9a-fA-F]+$/.test(hex)) return null;
    // Must be even length for valid hex
    if (hex.length % 2 !== 0) return null;
    return Buffer.from(hex, 'hex').toString('base64');
  } catch {
    return null;
  }
};

/**
 * Convert a base64 string to hex
 * @param base64 - Base64-encoded string
 * @returns Uppercase hex string or null if conversion fails
 */
export const base64ToHex = (base64: string): string | null => {
  try {
    // Check if it looks like base64 (contains base64-valid chars and possibly padding)
    if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) return null;
    const buffer = Buffer.from(base64, 'base64');
    // Verify the buffer decoded properly (not empty for non-empty input)
    if (buffer.length === 0 && base64.length > 0) return null;
    return buffer.toString('hex').toUpperCase();
  } catch {
    return null;
  }
};

/**
 * Normalize an ID by returning both the original and its converted format
 * @param id - Original ID string
 * @returns Object with original, hex, and base64 formats
 */
export const normalizeId = (id: string | null | undefined): {
  original: string | null;
  asHex: string | null;
  asBase64: string | null;
} => {
  if (!id) {
    return { original: null, asHex: null, asBase64: null };
  }

  return {
    original: id,
    asHex: base64ToHex(id),
    asBase64: hexToBase64(id),
  };
};

/**
 * Get all possible formats of a single ID
 * @param id - ID to expand
 * @returns Array of all format variations
 */
export const expandId = (id: string | null | undefined): string[] => {
  if (!id) return [];

  const variations = new Set<string>();
  variations.add(id);

  const asBase64 = hexToBase64(id);
  if (asBase64) variations.add(asBase64);

  const asHex = base64ToHex(id);
  if (asHex) variations.add(asHex);

  // Also add lowercase hex variant
  const asHexLower = asHex?.toLowerCase();
  if (asHexLower) variations.add(asHexLower);

  return Array.from(variations);
};

/**
 * Meeting identifiers interface
 */
export interface MeetingIdentifiers {
  meetingId?: string | null;
  calendarEventId?: string | null;
  onlineMeetingId?: string | null;
  icalUid?: string | null;
}

/**
 * Expand all meeting identifiers to include format conversions
 * This ensures matching works regardless of whether hex or base64 was stored
 * @param identifiers - Meeting identifiers to expand
 * @returns Array of all possible ID values for matching
 */
export const expandMeetingIdentifiers = (identifiers: MeetingIdentifiers): string[] => {
  const expanded = new Set<string>();

  const addWithConversions = (id: string | undefined | null) => {
    if (!id) return;

    expanded.add(id);

    const asBase64 = hexToBase64(id);
    if (asBase64) expanded.add(asBase64);

    const asHex = base64ToHex(id);
    if (asHex) {
      expanded.add(asHex);
      expanded.add(asHex.toLowerCase());
    }
  };

  addWithConversions(identifiers.meetingId);
  addWithConversions(identifiers.calendarEventId);
  addWithConversions(identifiers.onlineMeetingId);
  addWithConversions(identifiers.icalUid);

  return Array.from(expanded).filter(Boolean);
};

/**
 * Find the canonical (stored) meeting ID by checking all format variations
 * @param inputId - ID to look up
 * @param storedIds - Array of IDs stored in database
 * @returns The matching stored ID or null
 */
export const findMatchingId = (
  inputId: string | null | undefined,
  storedIds: (string | null | undefined)[]
): string | null => {
  if (!inputId) return null;

  const expandedInput = expandId(inputId);

  for (const storedId of storedIds) {
    if (!storedId) continue;

    // Direct match
    if (expandedInput.includes(storedId)) {
      return storedId;
    }

    // Check expanded stored ID
    const expandedStored = expandId(storedId);
    for (const variation of expandedInput) {
      if (expandedStored.includes(variation)) {
        return storedId;
      }
    }
  }

  return null;
};

/**
 * Check if two IDs represent the same meeting (accounting for format differences)
 * @param id1 - First ID
 * @param id2 - Second ID
 * @returns True if IDs match (in any format)
 */
export const idsMatch = (
  id1: string | null | undefined,
  id2: string | null | undefined
): boolean => {
  if (!id1 || !id2) return false;
  if (id1 === id2) return true;

  const expanded1 = expandId(id1);
  const expanded2 = expandId(id2);

  return expanded1.some(v => expanded2.includes(v));
};
