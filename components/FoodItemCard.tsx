'use client'

import { useState, useRef, useEffect } from 'react'
import type { FoodItem } from '@/types'
import {
  getUrgencyLevel,
  getExpiryStatusText,
  getUrgencyColor,
  formatDate,
} from '@/lib/utils/dateHelpers'

interface FoodItemCardProps {
  item: FoodItem
  onEdit: (item: FoodItem) => void
  onMarkUsed: (id: string) => Promise<void>
  onMarkTossed: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  isSelectMode?: boolean
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}

export default function FoodItemCard({
  item,
  onEdit,
  onMarkUsed,
  onMarkTossed,
  onDelete,
  isSelectMode,
  isSelected,
  onToggleSelect,
}: FoodItemCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Auto-hide menu on click outside or scroll
  useEffect(() => {
    if (!isMenuOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false)
      }
    }

    const handleScroll = () => {
      setIsMenuOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('scroll', handleScroll, { capture: true })

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('scroll', handleScroll, { capture: true })
    }
  }, [isMenuOpen])

  const urgency = getUrgencyLevel(item.expiry_date)
  const statusText = getExpiryStatusText(item.expiry_date)
  const colorClasses = getUrgencyColor(urgency)

  const handleMarkUsed = async () => {
    setIsLoading(true)
    try {
      await onMarkUsed(item.id)
    } finally {
      setIsLoading(false)
      setIsMenuOpen(false)
    }
  }

  const handleMarkTossed = async () => {
    setIsLoading(true)
    try {
      await onMarkTossed(item.id)
    } finally {
      setIsLoading(false)
      setIsMenuOpen(false)
    }
  }

  const handleDelete = async () => {
    if (confirm(`Delete "${item.name}"?`)) {
      setIsLoading(true)
      try {
        await onDelete(item.id)
      } finally {
        setIsLoading(false)
      }
    }
  }

  return (
    <div
      className={`relative border-l-4 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow ${colorClasses} ${isSelectMode ? 'cursor-pointer' : ''} ${isSelected ? 'ring-2 ring-orange-500' : ''}`}
      onClick={isSelectMode ? () => onToggleSelect?.(item.id) : undefined}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        {isSelectMode && (
          <div className="shrink-0 mr-2 mt-1">
            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected ? 'bg-orange-600 border-orange-600' : 'border-gray-300'}`}>
              {isSelected && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{item.name}</h3>
          {item.brand && (
            <p className="text-xs text-gray-500">{item.brand}</p>
          )}
          {item.category && (
            <span className="inline-block text-xs px-2 py-1 rounded-full bg-white bg-opacity-50 mt-1">
              {item.category}
            </span>
          )}
        </div>

        {/* Menu Button */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1 hover:bg-white hover:bg-opacity-50 rounded"
            disabled={isLoading}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10 border border-gray-200">
              <button
                onClick={() => {
                  onEdit(item)
                  setIsMenuOpen(false)
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              <button
                onClick={handleMarkUsed}
                disabled={isLoading}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-green-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Mark as Used
              </button>
              <button
                onClick={handleMarkTossed}
                disabled={isLoading}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-orange-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Mark as Tossed
              </button>
              <div className="border-t border-gray-200" />
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-2 text-red-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="mt-3 space-y-1 text-sm">
        {item.quantity && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
            </svg>
            <span>Quantity: {item.quantity}</span>
          </div>
        )}
        <div className="flex items-center gap-2 font-medium">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{statusText}</span>
        </div>
        <div className="text-xs opacity-75">
          Expiry: {formatDate(item.expiry_date)}
        </div>
        {item.notes && (
          <div className="mt-2 text-xs italic opacity-75">
            &quot;{item.notes}&quot;
          </div>
        )}
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 rounded-lg flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-green-600 rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  )
}
