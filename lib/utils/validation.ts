export interface ValidationErrors {
  name?: string
  notes?: string
  quantityAmount?: string
  expiry_date?: string
}

export function validateFoodItemForm(fields: {
  name: string
  notes: string
  quantityAmount: string
  expiry_date: string
}): ValidationErrors {
  const errors: ValidationErrors = {}

  const trimmedName = fields.name.trim()
  if (!trimmedName) {
    errors.name = 'Item name is required'
  } else if (trimmedName.length > 100) {
    errors.name = 'Item name must be 100 characters or less'
  }

  if (fields.notes && fields.notes.length > 500) {
    errors.notes = 'Notes must be 500 characters or less'
  }

  if (fields.quantityAmount) {
    const amount = parseFloat(fields.quantityAmount)
    if (isNaN(amount) || amount < 0) {
      errors.quantityAmount = 'Quantity must be a positive number'
    } else if (amount > 99999) {
      errors.quantityAmount = 'Quantity must be 99,999 or less'
    }
  }

  if (fields.expiry_date) {
    const expiry = new Date(fields.expiry_date)
    const twoYearsFromNow = new Date()
    twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2)
    if (expiry > twoYearsFromNow) {
      errors.expiry_date = 'Expiry date cannot be more than 2 years from today'
    }
  }

  return errors
}

export function hasErrors(errors: ValidationErrors): boolean {
  return Object.keys(errors).length > 0
}
