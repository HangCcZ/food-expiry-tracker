import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getDaysUntilExpiry,
  isExpired,
  getUrgencyLevel,
  formatDate,
  formatDateForInput,
  getExpiryStatusText,
  categorizeFoodItems,
} from '../dateHelpers'
import type { FoodItem } from '@/types'

// Fix "today" to 2025-06-15 for deterministic tests
const FIXED_NOW = new Date('2025-06-15T12:00:00')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

function makeItem(overrides: Partial<FoodItem> = {}): FoodItem {
  return {
    id: '1',
    user_id: 'u1',
    name: 'Milk',
    expiry_date: '2025-06-17',
    status: 'active',
    added_date: '2025-06-01',
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
    ...overrides,
  }
}

// ─── getDaysUntilExpiry ─────────────────────────────

describe('getDaysUntilExpiry', () => {
  it('returns 0 for today', () => {
    expect(getDaysUntilExpiry('2025-06-15')).toBe(0)
  })

  it('returns positive for future dates', () => {
    expect(getDaysUntilExpiry('2025-06-17')).toBe(2)
  })

  it('returns negative for past dates', () => {
    expect(getDaysUntilExpiry('2025-06-13')).toBe(-2)
  })

  it('returns 1 for tomorrow', () => {
    expect(getDaysUntilExpiry('2025-06-16')).toBe(1)
  })

  it('returns -1 for yesterday', () => {
    expect(getDaysUntilExpiry('2025-06-14')).toBe(-1)
  })
})

// ─── isExpired ──────────────────────────────────────

describe('isExpired', () => {
  it('returns false for today (day 0)', () => {
    expect(isExpired('2025-06-15')).toBe(false)
  })

  it('returns false for future date', () => {
    expect(isExpired('2025-06-20')).toBe(false)
  })

  it('returns true for past date', () => {
    expect(isExpired('2025-06-14')).toBe(true)
  })
})

// ─── getUrgencyLevel ────────────────────────────────

describe('getUrgencyLevel', () => {
  it('returns "expired" for past dates', () => {
    expect(getUrgencyLevel('2025-06-14')).toBe('expired')
  })

  it('returns "urgent" for day 0 (today)', () => {
    expect(getUrgencyLevel('2025-06-15')).toBe('urgent')
  })

  it('returns "urgent" for day 2', () => {
    expect(getUrgencyLevel('2025-06-17')).toBe('urgent')
  })

  it('returns "soon" for day 3', () => {
    expect(getUrgencyLevel('2025-06-18')).toBe('soon')
  })

  it('returns "soon" for day 5', () => {
    expect(getUrgencyLevel('2025-06-20')).toBe('soon')
  })

  it('returns "safe" for day 6', () => {
    expect(getUrgencyLevel('2025-06-21')).toBe('safe')
  })

  it('returns "safe" for far-future date', () => {
    expect(getUrgencyLevel('2025-12-31')).toBe('safe')
  })
})

// ─── formatDate ─────────────────────────────────────

describe('formatDate', () => {
  it('formats a date string for display', () => {
    const result = formatDate('2025-06-15')
    expect(result).toContain('Jun')
    expect(result).toContain('15')
    expect(result).toContain('2025')
  })
})

// ─── formatDateForInput ─────────────────────────────

describe('formatDateForInput', () => {
  it('formats to YYYY-MM-DD', () => {
    // Use T00:00:00 to ensure local time parsing
    expect(formatDateForInput(new Date('2025-01-05T00:00:00'))).toBe('2025-01-05')
  })

  it('pads single-digit months and days', () => {
    expect(formatDateForInput(new Date('2025-03-09T00:00:00'))).toBe('2025-03-09')
  })
})

// ─── getExpiryStatusText ────────────────────────────

describe('getExpiryStatusText', () => {
  it('says "Expires today" for day 0', () => {
    expect(getExpiryStatusText('2025-06-15')).toBe('Expires today')
  })

  it('says "Expires tomorrow" for day 1', () => {
    expect(getExpiryStatusText('2025-06-16')).toBe('Expires tomorrow')
  })

  it('says "Expires in N days" for day 3+', () => {
    expect(getExpiryStatusText('2025-06-18')).toBe('Expires in 3 days')
  })

  it('says "Expired 1 day ago" for -1', () => {
    expect(getExpiryStatusText('2025-06-14')).toBe('Expired 1 day ago')
  })

  it('says "Expired N days ago" for -3', () => {
    expect(getExpiryStatusText('2025-06-12')).toBe('Expired 3 days ago')
  })
})

// ─── categorizeFoodItems ────────────────────────────

describe('categorizeFoodItems', () => {
  it('groups items into urgent, soon, safe', () => {
    const items = [
      makeItem({ id: '1', expiry_date: '2025-06-15' }), // day 0 → urgent
      makeItem({ id: '2', expiry_date: '2025-06-17' }), // day 2 → urgent
      makeItem({ id: '3', expiry_date: '2025-06-18' }), // day 3 → soon
      makeItem({ id: '4', expiry_date: '2025-06-20' }), // day 5 → soon
      makeItem({ id: '5', expiry_date: '2025-06-21' }), // day 6 → safe
    ]

    const result = categorizeFoodItems(items)
    expect(result.urgent).toHaveLength(2)
    expect(result.soon).toHaveLength(2)
    expect(result.safe).toHaveLength(1)
  })

  it('excludes expired items', () => {
    const items = [
      makeItem({ id: '1', expiry_date: '2025-06-14' }), // expired
      makeItem({ id: '2', expiry_date: '2025-06-15' }), // urgent
    ]

    const result = categorizeFoodItems(items)
    expect(result.urgent).toHaveLength(1)
    expect(result.soon).toHaveLength(0)
    expect(result.safe).toHaveLength(0)
  })

  it('returns empty arrays for no items', () => {
    const result = categorizeFoodItems([])
    expect(result.urgent).toHaveLength(0)
    expect(result.soon).toHaveLength(0)
    expect(result.safe).toHaveLength(0)
  })
})
