'use client';

import { useState } from 'react';
import type { FoodItem, FoodItemFormData } from '@/types';
import { categorizeFoodItems } from '@/lib/utils/dateHelpers';
import FoodItemCard from './FoodItemCard';
import FoodItemForm from './FoodItemForm';
import PushNotificationSetup from './PushNotificationSetup';
import RecipeSuggestions from './RecipeSuggestions';
import { useFoodItems } from '@/lib/hooks/useFoodItems';
import { useAuth } from '@/lib/hooks/useAuth';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const { items, loading, addItem, updateItem, updateStatus, deleteItem } =
    useFoodItems(user?.id);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodItem | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({
    urgent: false,
    soon: false,
    safe: true,
  });

  const toggleSection = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const categorized = categorizeFoodItems(items);
  const handleAddItem = async (data: FoodItemFormData) => {
    if (editingItem) {
      await updateItem(editingItem.id, data);
      setEditingItem(null);
    } else {
      await addItem(data);
    }
    setIsFormOpen(false);
  };

  const handleEdit = (item: FoodItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setEditingItem(null);
  };

  const handleMarkUsed = async (id: string) => {
    await updateStatus(id, 'used');
  };

  const handleMarkTossed = async (id: string) => {
    await updateStatus(id, 'tossed');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your food items...</p>
        </div>
      </div>
    );
  }

  const sections = [
    {
      key: 'urgent',
      label: 'Urgent',
      subtitle: 'Expiring in 0-2 days',
      items: categorized.urgent,
      accent: 'border-red-400',
      headerBg: 'bg-red-50',
      headerText: 'text-red-800',
      badge: 'bg-red-100 text-red-700',
      chevron: 'text-red-400',
    },
    {
      key: 'soon',
      label: 'Expiring Soon',
      subtitle: '3-5 days left',
      items: categorized.soon,
      accent: 'border-amber-400',
      headerBg: 'bg-amber-50',
      headerText: 'text-amber-800',
      badge: 'bg-amber-100 text-amber-700',
      chevron: 'text-amber-400',
    },
    {
      key: 'safe',
      label: 'Fresh',
      subtitle: 'More than 5 days',
      items: categorized.safe,
      accent: 'border-emerald-400',
      headerBg: 'bg-emerald-50',
      headerText: 'text-emerald-800',
      badge: 'bg-emerald-100 text-emerald-700',
      chevron: 'text-emerald-400',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold text-gray-900">
                Food Expiry Tracker
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 hidden sm:block">
                {user?.email}
              </span>
              <button
                onClick={() => {
                  setEditingItem(null);
                  setIsFormOpen(true);
                }}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 flex items-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add</span>
              </button>
              <button
                onClick={signOut}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                title="Sign out"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Notification & Recipe banners */}
        <PushNotificationSetup />
        <RecipeSuggestions />

        {items.length === 0 ? (
          /* Empty State */
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-4xl">🥗</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No food items yet
            </h2>
            <p className="text-gray-500 mb-6 text-sm">
              Start tracking your food to reduce waste
            </p>
            <button
              onClick={() => setIsFormOpen(true)}
              className="px-5 py-2.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Add Your First Item
            </button>
          </div>
        ) : (
          <>
            {/* Quick stats bar */}
            <div className="flex gap-3">
              {sections.map((s) => (
                <button
                  key={s.key}
                  onClick={() => {
                    if (s.items.length > 0) {
                      setCollapsed((prev) => ({ ...prev, [s.key]: false }));
                      document.getElementById(`section-${s.key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                  className={`flex-1 rounded-lg p-3 text-center transition-colors ${s.headerBg} hover:opacity-80`}
                >
                  <p className={`text-2xl font-bold ${s.headerText}`}>{s.items.length}</p>
                  <p className={`text-xs ${s.headerText} opacity-75`}>{s.label}</p>
                </button>
              ))}
            </div>

            {/* Category sections */}
            {sections.map((s) =>
              s.items.length > 0 ? (
                <section
                  key={s.key}
                  id={`section-${s.key}`}
                  className={`bg-white rounded-lg border-l-4 ${s.accent} shadow-sm overflow-hidden scroll-mt-20`}
                >
                  {/* Section header */}
                  <button
                    onClick={() => toggleSection(s.key)}
                    className={`w-full flex items-center justify-between px-4 py-3 ${s.headerBg} hover:opacity-90 transition-opacity`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${s.headerText}`}>
                        {s.label}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
                        {s.items.length}
                      </span>
                      <span className={`text-xs ${s.headerText} opacity-60 hidden sm:inline`}>
                        {s.subtitle}
                      </span>
                    </div>
                    <svg
                      className={`w-4 h-4 ${s.chevron} transition-transform duration-200 ${collapsed[s.key] ? '' : 'rotate-90'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>

                  {/* Section items */}
                  {!collapsed[s.key] && (
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {s.items.map((item) => (
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
                  )}
                </section>
              ) : null
            )}
          </>
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
  );
}
