/**
 * Create/Edit Event Modal
 * Form for creating and editing calendar events
 */

import React, { useState, useEffect } from 'react';
import type { CreateEventParams } from '../../../../helix-runtime/src/types/calendar';

interface CreateEventModalProps {
  event?: any;
  onSave: (event: CreateEventParams) => void;
  onClose: () => void;
  isSaving: boolean;
}

export const CreateEventModal: React.FC<CreateEventModalProps> = ({
  event,
  onSave,
  onClose,
  isSaving,
}) => {
  const [formData, setFormData] = useState<CreateEventParams>({
    title: event?.title || '',
    description: event?.description || '',
    start_time: event?.start_time || new Date().toISOString(),
    end_time: event?.end_time || new Date(Date.now() + 3600000).toISOString(),
    is_all_day: event?.is_all_day || false,
    location: event?.location || '',
    attendees: event?.attendees || [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    const startDate = new Date(formData.start_time);
    const endDate = new Date(formData.end_time);

    if (startDate >= endDate) {
      newErrors.end_time = 'End time must be after start time';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
    }
  };

  const handleChange = (field: keyof CreateEventParams, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: '',
      }));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700 sticky top-0 bg-slate-900">
          <h2 className="text-xl font-bold text-slate-100">
            {event ? 'Edit Event' : 'New Event'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-2xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Event Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Enter event title"
            />
            {errors.title && <p className="text-xs text-red-400 mt-1">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
              rows={3}
              placeholder="Enter event description"
            />
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="allDay"
              checked={formData.is_all_day || false}
              onChange={(e) => handleChange('is_all_day', e.target.checked)}
              className="w-4 h-4 accent-blue-600"
            />
            <label htmlFor="allDay" className="text-sm text-slate-300">
              All Day Event
            </label>
          </div>

          {/* Start Time */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Start Time *
            </label>
            <input
              type={formData.is_all_day ? 'date' : 'datetime-local'}
              value={formData.start_time.slice(0, 16)}
              onChange={(e) => {
                const value = formData.is_all_day
                  ? new Date(e.target.value).toISOString()
                  : new Date(e.target.value).toISOString();
                handleChange('start_time', value);
              }}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* End Time */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              End Time *
            </label>
            <input
              type={formData.is_all_day ? 'date' : 'datetime-local'}
              value={formData.end_time.slice(0, 16)}
              onChange={(e) => {
                const value = formData.is_all_day
                  ? new Date(e.target.value).toISOString()
                  : new Date(e.target.value).toISOString();
                handleChange('end_time', value);
              }}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {errors.end_time && <p className="text-xs text-red-400 mt-1">{errors.end_time}</p>}
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Location
            </label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => handleChange('location', e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              placeholder="Enter event location"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-700 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium transition-colors"
            >
              {isSaving ? 'Saving...' : event ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
