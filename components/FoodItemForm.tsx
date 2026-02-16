'use client'

import { useState, useEffect } from 'react'
import type { FoodItem, FoodItemFormData } from '@/types'
import { FOOD_CATEGORIES, QUANTITY_UNITS } from '@/types'
import { getTodayString } from '@/lib/utils/dateHelpers'
import { validateFoodItemForm, hasErrors, type ValidationErrors } from '@/lib/utils/validation'
import CustomSelect from './CustomSelect'

interface FoodItemFormProps {
  onSubmit: (data: FoodItemFormData) => Promise<void>
  onCancel: () => void
  initialData?: FoodItem | null
  isOpen: boolean
}

export default function FoodItemForm({
  onSubmit,
  onCancel,
  initialData,
  isOpen,
}: FoodItemFormProps) {
  const [formData, setFormData] = useState<FoodItemFormData>({
    name: '',
    quantity: '',
    category: '',
    expiry_date: getTodayString(),
    notes: '',
  })
  const [quantityAmount, setQuantityAmount] = useState('')
  const [quantityUnit, setQuantityUnit] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<ValidationErrors>({})

  // Populate form when editing
  useEffect(() => {
    setErrors({})
    if (initialData) {
      const qty = initialData.quantity || ''
      const match = qty.match(/^(\d+\.?\d*)\s*(.*)$/)
      if (match) {
        setQuantityAmount(match[1])
        setQuantityUnit(match[2])
      } else {
        setQuantityAmount('')
        setQuantityUnit('')
      }

      setFormData({
        name: initialData.name,
        quantity: initialData.quantity || '',
        category: initialData.category || '',
        expiry_date: initialData.expiry_date,
        notes: initialData.notes || '',
      })
    } else {
      setQuantityAmount('')
      setQuantityUnit('')
      setFormData({
        name: '',
        quantity: '',
        category: '',
        expiry_date: getTodayString(),
        notes: '',
      })
    }
  }, [initialData, isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate
    const validationErrors = validateFoodItemForm({
      name: formData.name,
      notes: formData.notes || '',
      quantityAmount,
      expiry_date: formData.expiry_date,
    })

    if (hasErrors(validationErrors)) {
      setErrors(validationErrors)
      return
    }

    setIsSubmitting(true)
    setErrors({})

    try {
      const quantity = quantityAmount && quantityUnit
        ? `${quantityAmount} ${quantityUnit}`
        : quantityAmount || ''

      await onSubmit({ ...formData, name: formData.name.trim(), quantity })

      if (!initialData) {
        setQuantityAmount('')
        setQuantityUnit('')
        setFormData({
          name: '',
          quantity: '',
          category: '',
          expiry_date: getTodayString(),
          notes: '',
        })
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      alert('Failed to save item. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name as keyof ValidationErrors]) {
      setErrors((prev) => { const next = { ...prev }; delete next[name as keyof ValidationErrors]; return next })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {initialData ? 'Edit Food Item' : 'Add Food Item'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
            disabled={isSubmitting}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Item Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              maxLength={100}
              value={formData.name}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg text-gray-900 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${errors.name ? 'border-red-300' : 'border-gray-300'}`}
              placeholder="e.g., Milk, Chicken, Lettuce"
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category
            </label>
            <CustomSelect
              value={formData.category || ''}
              onChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
              options={FOOD_CATEGORIES as unknown as string[]}
              placeholder="Select category..."
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Quantity
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="99999"
                value={quantityAmount}
                onChange={(e) => {
                  setQuantityAmount(e.target.value)
                  if (errors.quantityAmount) {
                    setErrors((prev) => { const next = { ...prev }; delete next.quantityAmount; return next })
                  }
                }}
                className={`flex-1 px-3 py-2 border rounded-lg text-gray-900 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${errors.quantityAmount ? 'border-red-300' : 'border-gray-300'}`}
                placeholder="Amount"
              />
              <CustomSelect
                value={quantityUnit}
                onChange={setQuantityUnit}
                options={QUANTITY_UNITS as unknown as string[]}
                placeholder="Unit"
                className="w-32"
              />
            </div>
            {errors.quantityAmount && <p className="mt-1 text-xs text-red-500">{errors.quantityAmount}</p>}
          </div>

          {/* Expiry Date */}
          <div>
            <label htmlFor="expiry_date" className="block text-sm font-medium text-gray-700 mb-1">
              Expiry Date *
            </label>
            <input
              type="date"
              id="expiry_date"
              name="expiry_date"
              required
              value={formData.expiry_date}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${errors.expiry_date ? 'border-red-300' : 'border-gray-300'}`}
            />
            {errors.expiry_date && <p className="mt-1 text-xs text-red-500">{errors.expiry_date}</p>}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={500}
              value={formData.notes}
              onChange={handleChange}
              className={`w-full px-3 py-2 border rounded-lg text-gray-900 placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none ${errors.notes ? 'border-red-300' : 'border-gray-300'}`}
              placeholder="Any additional notes..."
            />
            {errors.notes && <p className="mt-1 text-xs text-red-500">{errors.notes}</p>}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 flex items-center justify-center"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Saving...
                </>
              ) : initialData ? (
                'Update Item'
              ) : (
                'Add Item'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
