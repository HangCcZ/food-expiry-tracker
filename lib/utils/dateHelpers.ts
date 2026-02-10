import type { FoodItem, CategorizedItems } from '@/types'

/**
 * Calculate days until expiry from today
 */
export function getDaysUntilExpiry(expiryDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)

  const diffTime = expiry.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return diffDays
}

/**
 * Check if an item is expired
 */
export function isExpired(expiryDate: string): boolean {
  return getDaysUntilExpiry(expiryDate) < 0
}

/**
 * Get urgency level based on days until expiry
 * - urgent: 0-2 days
 * - soon: 3-5 days
 * - safe: > 5 days
 */
export function getUrgencyLevel(
  expiryDate: string
): 'expired' | 'urgent' | 'soon' | 'safe' {
  const days = getDaysUntilExpiry(expiryDate)

  if (days < 0) return 'expired'
  if (days <= 2) return 'urgent'
  if (days <= 5) return 'soon'
  return 'safe'
}

/**
 * Format date for display
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/**
 * Format date for input field (YYYY-MM-DD)
 */
export function formatDateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get human-readable expiry status
 */
export function getExpiryStatusText(expiryDate: string): string {
  const days = getDaysUntilExpiry(expiryDate)

  if (days < 0) {
    const absDays = Math.abs(days)
    return `Expired ${absDays} day${absDays === 1 ? '' : 's'} ago`
  }

  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'

  return `Expires in ${days} days`
}

/**
 * Get color class based on urgency
 */
export function getUrgencyColor(urgency: 'expired' | 'urgent' | 'soon' | 'safe'): string {
  switch (urgency) {
    case 'expired':
      return 'bg-gray-100 border-gray-300 text-gray-700'
    case 'urgent':
      return 'bg-red-50 border-red-300 text-red-800'
    case 'soon':
      return 'bg-yellow-50 border-yellow-300 text-yellow-800'
    case 'safe':
      return 'bg-green-50 border-green-300 text-green-800'
    default:
      return 'bg-gray-100 border-gray-300 text-gray-700'
  }
}

/**
 * Get badge color based on urgency
 */
export function getUrgencyBadgeColor(
  urgency: 'expired' | 'urgent' | 'soon' | 'safe'
): string {
  switch (urgency) {
    case 'expired':
      return 'bg-gray-200 text-gray-700'
    case 'urgent':
      return 'bg-red-100 text-red-700'
    case 'soon':
      return 'bg-yellow-100 text-yellow-700'
    case 'safe':
      return 'bg-green-100 text-green-700'
    default:
      return 'bg-gray-200 text-gray-700'
  }
}

/**
 * Categorize food items by urgency level
 */
export function categorizeFoodItems(items: FoodItem[]): CategorizedItems {
  const categorized: CategorizedItems = {
    urgent: [],
    soon: [],
    safe: [],
  }

  items.forEach((item) => {
    const urgency = getUrgencyLevel(item.expiry_date)

    if (urgency === 'urgent') {
      categorized.urgent.push(item)
    } else if (urgency === 'soon') {
      categorized.soon.push(item)
    } else if (urgency === 'safe') {
      categorized.safe.push(item)
    }
    // Expired items are filtered out (not shown in active items)
  })

  return categorized
}

/**
 * Get today's date as YYYY-MM-DD for input default
 */
export function getTodayString(): string {
  return formatDateForInput(new Date())
}
