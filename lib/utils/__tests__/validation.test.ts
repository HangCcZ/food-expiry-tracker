import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { validateFoodItemForm, hasErrors } from '../validation'

const FIXED_NOW = new Date('2025-06-15T12:00:00')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(FIXED_NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

const validInput = {
  name: 'Milk',
  notes: '',
  quantityAmount: '2',
  expiry_date: '2025-06-20',
}

// ─── hasErrors ──────────────────────────────────────

describe('hasErrors', () => {
  it('returns false for empty errors', () => {
    expect(hasErrors({})).toBe(false)
  })

  it('returns true when there are errors', () => {
    expect(hasErrors({ name: 'Required' })).toBe(true)
  })
})

// ─── name validation ────────────────────────────────

describe('name validation', () => {
  it('passes for valid name', () => {
    const errors = validateFoodItemForm(validInput)
    expect(errors.name).toBeUndefined()
  })

  it('fails for empty name', () => {
    const errors = validateFoodItemForm({ ...validInput, name: '' })
    expect(errors.name).toBe('Item name is required')
  })

  it('fails for whitespace-only name', () => {
    const errors = validateFoodItemForm({ ...validInput, name: '   ' })
    expect(errors.name).toBe('Item name is required')
  })

  it('passes for name at exactly 100 characters', () => {
    const errors = validateFoodItemForm({ ...validInput, name: 'a'.repeat(100) })
    expect(errors.name).toBeUndefined()
  })

  it('fails for name over 100 characters', () => {
    const errors = validateFoodItemForm({ ...validInput, name: 'a'.repeat(101) })
    expect(errors.name).toBe('Item name must be 100 characters or less')
  })
})

// ─── brand validation ────────────────────────────────

describe('brand validation', () => {
  it('passes for empty brand (optional)', () => {
    const errors = validateFoodItemForm({ ...validInput, brand: '' })
    expect(errors.brand).toBeUndefined()
  })

  it('passes for undefined brand', () => {
    const errors = validateFoodItemForm(validInput)
    expect(errors.brand).toBeUndefined()
  })

  it('passes for brand at exactly 100 characters', () => {
    const errors = validateFoodItemForm({ ...validInput, brand: 'a'.repeat(100) })
    expect(errors.brand).toBeUndefined()
  })

  it('fails for brand over 100 characters', () => {
    const errors = validateFoodItemForm({ ...validInput, brand: 'a'.repeat(101) })
    expect(errors.brand).toBe('Brand must be 100 characters or less')
  })
})

// ─── notes validation ───────────────────────────────

describe('notes validation', () => {
  it('passes for empty notes', () => {
    const errors = validateFoodItemForm({ ...validInput, notes: '' })
    expect(errors.notes).toBeUndefined()
  })

  it('passes for notes at exactly 500 characters', () => {
    const errors = validateFoodItemForm({ ...validInput, notes: 'a'.repeat(500) })
    expect(errors.notes).toBeUndefined()
  })

  it('fails for notes over 500 characters', () => {
    const errors = validateFoodItemForm({ ...validInput, notes: 'a'.repeat(501) })
    expect(errors.notes).toBe('Notes must be 500 characters or less')
  })
})

// ─── quantity validation ────────────────────────────

describe('quantity validation', () => {
  it('passes for empty quantity (optional)', () => {
    const errors = validateFoodItemForm({ ...validInput, quantityAmount: '' })
    expect(errors.quantityAmount).toBeUndefined()
  })

  it('passes for valid positive number', () => {
    const errors = validateFoodItemForm({ ...validInput, quantityAmount: '5' })
    expect(errors.quantityAmount).toBeUndefined()
  })

  it('passes for zero', () => {
    const errors = validateFoodItemForm({ ...validInput, quantityAmount: '0' })
    expect(errors.quantityAmount).toBeUndefined()
  })

  it('fails for negative number', () => {
    const errors = validateFoodItemForm({ ...validInput, quantityAmount: '-1' })
    expect(errors.quantityAmount).toBe('Quantity must be a positive number')
  })

  it('fails for non-numeric input', () => {
    const errors = validateFoodItemForm({ ...validInput, quantityAmount: 'abc' })
    expect(errors.quantityAmount).toBe('Quantity must be a positive number')
  })

  it('passes for quantity at 99999', () => {
    const errors = validateFoodItemForm({ ...validInput, quantityAmount: '99999' })
    expect(errors.quantityAmount).toBeUndefined()
  })

  it('fails for quantity over 99999', () => {
    const errors = validateFoodItemForm({ ...validInput, quantityAmount: '100000' })
    expect(errors.quantityAmount).toBe('Quantity must be 99,999 or less')
  })
})

// ─── expiry_date validation ─────────────────────────

describe('expiry_date validation', () => {
  it('passes for a near-future date', () => {
    const errors = validateFoodItemForm({ ...validInput, expiry_date: '2025-07-01' })
    expect(errors.expiry_date).toBeUndefined()
  })

  it('passes for date at exactly 2 years from now', () => {
    const errors = validateFoodItemForm({ ...validInput, expiry_date: '2027-06-15' })
    expect(errors.expiry_date).toBeUndefined()
  })

  it('fails for date more than 2 years from now', () => {
    const errors = validateFoodItemForm({ ...validInput, expiry_date: '2027-06-16' })
    expect(errors.expiry_date).toBe('Expiry date cannot be more than 2 years from today')
  })

  it('passes for empty date (optional)', () => {
    const errors = validateFoodItemForm({ ...validInput, expiry_date: '' })
    expect(errors.expiry_date).toBeUndefined()
  })
})

// ─── combined ───────────────────────────────────────

describe('combined validation', () => {
  it('returns no errors for fully valid input', () => {
    const errors = validateFoodItemForm(validInput)
    expect(hasErrors(errors)).toBe(false)
  })

  it('returns multiple errors at once', () => {
    const errors = validateFoodItemForm({
      name: '',
      notes: 'a'.repeat(501),
      quantityAmount: '-5',
      expiry_date: '2030-01-01',
    })
    expect(errors.name).toBeDefined()
    expect(errors.notes).toBeDefined()
    expect(errors.quantityAmount).toBeDefined()
    expect(errors.expiry_date).toBeDefined()
  })
})
