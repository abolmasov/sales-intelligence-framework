import { describe, it, expect } from 'vitest';
import {
  hexToBase64,
  base64ToHex,
  normalizeId,
  expandId,
  expandMeetingIdentifiers,
  findMatchingId,
  idsMatch,
} from './idConversion';

describe('hexToBase64', () => {
  it('converts valid hex to base64', () => {
    const hex = '48656C6C6F'; // "Hello"
    const result = hexToBase64(hex);
    expect(result).toBe(Buffer.from('Hello').toString('base64'));
  });

  it('returns null for non-hex string', () => {
    expect(hexToBase64('not-hex!')).toBeNull();
  });

  it('returns null for odd-length hex', () => {
    expect(hexToBase64('abc')).toBeNull();
  });

  it('handles lowercase hex', () => {
    expect(hexToBase64('48656c6c6f')).toBe(hexToBase64('48656C6C6F'));
  });
});

describe('base64ToHex', () => {
  it('converts valid base64 to uppercase hex', () => {
    const base64 = Buffer.from('Hello').toString('base64');
    const result = base64ToHex(base64);
    expect(result).toBe('48656C6C6F');
  });

  it('returns null for non-base64 string', () => {
    expect(base64ToHex('not base64!!!')).toBeNull();
  });

  it('handles base64 with padding', () => {
    const base64 = Buffer.from('Hi').toString('base64'); // "SGk="
    const result = base64ToHex(base64);
    expect(result).toBeTruthy();
  });
});

describe('hexToBase64 / base64ToHex round-trip', () => {
  it('hex → base64 → hex preserves original', () => {
    const original = '48656C6C6F576F726C64';
    const base64 = hexToBase64(original)!;
    const back = base64ToHex(base64)!;
    expect(back).toBe(original.toUpperCase());
  });

  it('base64 → hex → base64 preserves original', () => {
    const original = Buffer.from('TestData123').toString('base64');
    const hex = base64ToHex(original)!;
    const back = hexToBase64(hex)!;
    expect(back).toBe(original);
  });
});

describe('normalizeId', () => {
  it('returns all nulls for null input', () => {
    const result = normalizeId(null);
    expect(result).toEqual({ original: null, asHex: null, asBase64: null });
  });

  it('returns all nulls for undefined input', () => {
    const result = normalizeId(undefined);
    expect(result).toEqual({ original: null, asHex: null, asBase64: null });
  });

  it('returns original and conversions for valid hex', () => {
    const hex = '48656C6C6F';
    const result = normalizeId(hex);
    expect(result.original).toBe(hex);
    expect(result.asBase64).toBeTruthy();
  });
});

describe('expandId', () => {
  it('returns empty array for null', () => {
    expect(expandId(null)).toEqual([]);
  });

  it('always includes the original', () => {
    const id = 'some-uuid-string';
    const expanded = expandId(id);
    expect(expanded).toContain(id);
  });

  it('includes hex and base64 for convertible IDs', () => {
    const hex = '48656C6C6F';
    const expanded = expandId(hex);
    // Should include original, base64 conversion
    expect(expanded.length).toBeGreaterThan(1);
    expect(expanded).toContain(hex);
  });
});

describe('expandMeetingIdentifiers', () => {
  it('returns empty array for empty identifiers', () => {
    const result = expandMeetingIdentifiers({});
    expect(result).toEqual([]);
  });

  it('includes all provided identifiers', () => {
    const result = expandMeetingIdentifiers({
      meetingId: 'mtg-123',
      calendarEventId: 'cal-456',
    });
    expect(result).toContain('mtg-123');
    expect(result).toContain('cal-456');
  });

  it('deduplicates identical identifiers', () => {
    const result = expandMeetingIdentifiers({
      meetingId: 'same-id',
      calendarEventId: 'same-id',
    });
    const count = result.filter((id) => id === 'same-id').length;
    expect(count).toBe(1);
  });
});

describe('findMatchingId', () => {
  it('returns null for null input', () => {
    expect(findMatchingId(null, ['a', 'b'])).toBeNull();
  });

  it('finds direct match', () => {
    expect(findMatchingId('abc', ['abc', 'def'])).toBe('abc');
  });

  it('returns null when no match', () => {
    expect(findMatchingId('xyz', ['abc', 'def'])).toBeNull();
  });

  it('matches hex ↔ base64 conversion', () => {
    const hex = '48656C6C6F';
    const base64 = hexToBase64(hex)!;
    expect(findMatchingId(hex, [base64])).toBe(base64);
  });
});

describe('idsMatch', () => {
  it('returns false for null inputs', () => {
    expect(idsMatch(null, 'abc')).toBe(false);
    expect(idsMatch('abc', null)).toBe(false);
    expect(idsMatch(null, null)).toBe(false);
  });

  it('returns true for identical strings', () => {
    expect(idsMatch('abc', 'abc')).toBe(true);
  });

  it('returns false for unrelated strings', () => {
    expect(idsMatch('abc', 'xyz')).toBe(false);
  });

  it('matches hex and base64 representations', () => {
    const hex = '48656C6C6F';
    const base64 = hexToBase64(hex)!;
    expect(idsMatch(hex, base64)).toBe(true);
  });
});
