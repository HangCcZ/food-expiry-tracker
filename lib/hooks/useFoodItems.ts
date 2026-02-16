'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { FoodItem, FoodItemFormData } from '@/types'

/**
 * Hook to manage food items CRUD operations
 * Provides loading state, error handling, and real-time updates
 */
export function useFoodItems(userId: string | undefined) {
  const [items, setItems] = useState<FoodItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  // Fetch food items
  const fetchItems = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('food_items')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('expiry_date', { ascending: true })

      if (fetchError) throw fetchError

      setItems(data || [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch items')
      console.error('Error fetching food items:', err)
    } finally {
      setLoading(false)
    }
  }, [userId, supabase])

  // Add new food item
  const addItem = async (itemData: FoodItemFormData) => {
    if (!userId) throw new Error('User not authenticated')

    const { data, error: insertError } = await supabase
      .from('food_items')
      .insert([
        {
          ...itemData,
          user_id: userId,
          status: 'active',
        },
      ])
      .select()
      .single()

    if (insertError) throw insertError

    // Optimistically update local state
    setItems((prev) => [...prev, data])
    return data
  }

  // Update food item
  const updateItem = async (id: string, updates: Partial<FoodItemFormData>) => {
    const { data, error: updateError } = await supabase
      .from('food_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    // Update local state
    setItems((prev) => prev.map((item) => (item.id === id ? data : item)))
    return data
  }

  // Mark item as used or tossed
  const updateStatus = async (id: string, status: 'used' | 'tossed') => {
    const { error: updateError } = await supabase
      .from('food_items')
      .update({ status })
      .eq('id', id)

    if (updateError) throw updateError

    // Remove from local state (we only show active items)
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  // Delete food item
  const deleteItem = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('food_items')
      .delete()
      .eq('id', id)

    if (deleteError) throw deleteError

    // Remove from local state
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  // Set up real-time subscription
  useEffect(() => {
    fetchItems()

    if (!userId) return

    // Subscribe to real-time changes
    const channel = supabase
      .channel('food_items_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'food_items',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems((prev) => [...prev, payload.new as FoodItem])
          } else if (payload.eventType === 'UPDATE') {
            setItems((prev) =>
              prev.map((item) =>
                item.id === payload.new.id ? (payload.new as FoodItem) : item
              )
            )
          } else if (payload.eventType === 'DELETE') {
            setItems((prev) => prev.filter((item) => item.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, supabase, fetchItems])

  return {
    items,
    loading,
    error,
    addItem,
    updateItem,
    updateStatus,
    deleteItem,
    refetch: fetchItems,
  }
}
