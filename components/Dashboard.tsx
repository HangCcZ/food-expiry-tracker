'use client'

import { useState } from 'react'
import type { FoodItem, FoodItemFormData } from '@/types'
import { categorizeFoodItems } from '@/lib/utils/dateHelpers'
import FoodItemCard from './FoodItemCard'
import FoodItemForm from './FoodItemForm'
import { useFoodItems } from '@/lib/hooks/useFoodItems'
import { useAuth } from '@/lib/hooks/useAuth'

export default function Dashboard() {
  const { user, signOut } = useAuth()
  const { items, loading, addItem, updateItem, updateStatus, deleteItem } = useFoodItems(
    user?.id
  )
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null)

  const categorized = categorizeFoodItems(items)

  const handleAddItem = async (data: FoodItemFormData) => {
    if (editingItem) {
      // Update existing item
      await updateItem(editingItem.id, data)
      setEditingItem(null)
    } else {
      // Add new item
      await addItem(data)
    }
    setIsFormOpen(false)
  }

  const handleEdit = (item: FoodItem) => {
    setEditingItem(item)
    setIsFormOpen(true)
  }

  const handleCancel = () => {
    setIsFormOpen(false)
    setEditingItem(null)
  }

  const handleMarkUsed = async (id: string) => {
    await updateStatus(id, 'used')
  }

  const handleMarkTossed = async (id: string) => {
    await updateStatus(id, 'tossed')
  }

  const handleSignOut = async () => {
    await signOut()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your food items...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">🍎</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Food Expiry Tracker</h1>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEditingItem(null)
                  setIsFormOpen(true)
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span className="hidden sm:inline">Add Item</span>
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-gray-600 hover:text-gray-900 focus:outline-none"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {items.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12">
            <div className="flex justify-center mb-4">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-5xl">🥗</span>
              </div>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">No food items yet</h2>
            <p className="text-gray-600 mb-6">
              Start tracking your food expiry dates to reduce waste!
            </p>
            <button
              onClick={() => setIsFormOpen(true)}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Add Your First Item
            </button>
          </div>
        ) : (
          /* Categorized Items */
          <div className="space-y-8">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-red-700 font-medium">Urgent</p>
                    <p className="text-2xl font-bold text-red-900">{categorized.urgent.length}</p>
                    <p className="text-xs text-red-600">0-2 days</p>
                  </div>
                  <span className="text-3xl">⚠️</span>
                </div>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-700 font-medium">Soon</p>
                    <p className="text-2xl font-bold text-yellow-900">{categorized.soon.length}</p>
                    <p className="text-xs text-yellow-600">3-5 days</p>
                  </div>
                  <span className="text-3xl">📅</span>
                </div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-700 font-medium">Safe</p>
                    <p className="text-2xl font-bold text-green-900">{categorized.safe.length}</p>
                    <p className="text-xs text-green-600">&gt;5 days</p>
                  </div>
                  <span className="text-3xl">✅</span>
                </div>
              </div>
            </div>

            {/* Urgent Items */}
            {categorized.urgent.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-red-900 mb-3 flex items-center gap-2">
                  <span>⚠️</span>
                  Urgent - Use Soon! ({categorized.urgent.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categorized.urgent.map((item) => (
                    <FoodItemCard
                      key={item.id}
                      item={item}
                      onEdit={handleEdit}
                      onMarkUsed={handleMarkUsed}
                      onMarkTossed={handleMarkTossed}
                      onDelete={deleteItem}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Soon Items */}
            {categorized.soon.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-yellow-900 mb-3 flex items-center gap-2">
                  <span>📅</span>
                  Expiring Soon ({categorized.soon.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categorized.soon.map((item) => (
                    <FoodItemCard
                      key={item.id}
                      item={item}
                      onEdit={handleEdit}
                      onMarkUsed={handleMarkUsed}
                      onMarkTossed={handleMarkTossed}
                      onDelete={deleteItem}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Safe Items */}
            {categorized.safe.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <span>✅</span>
                  Still Fresh ({categorized.safe.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categorized.safe.map((item) => (
                    <FoodItemCard
                      key={item.id}
                      item={item}
                      onEdit={handleEdit}
                      onMarkUsed={handleMarkUsed}
                      onMarkTossed={handleMarkTossed}
                      onDelete={deleteItem}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Form Modal */}
      <FoodItemForm
        isOpen={isFormOpen}
        initialData={editingItem}
        onSubmit={handleAddItem}
        onCancel={handleCancel}
      />
    </div>
  )
}
