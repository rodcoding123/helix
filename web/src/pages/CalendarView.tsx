/**
 * Calendar View Page
 * Week 4 Track 4: Calendar Foundation - Task 4.3
 * Main calendar interface with month/week/day views
 */

import { useState } from 'react';
import { useCalendarClient } from '../hooks/useCalendarClient';
import { CalendarGrid } from '../components/calendar/CalendarGrid';
import { EventDetail } from '../components/calendar/EventDetail';
import { CreateEventModal } from '../components/calendar/CreateEventModal';

export function CalendarView() {
  const {
    events,
    selectedEvent,
    isLoading,
    isCreating,
    isSyncing,
    error,
    viewType,
    currentDate,
    getEvent,
    createEvent,
    updateEvent,
    deleteEvent,
    changeDate,
  } = useCalendarClient();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);

  const handleCreateEvent = async (eventData: any) => {
    if (editingEvent) {
      await updateEvent(editingEvent.id, eventData);
      setEditingEvent(null);
    } else {
      await createEvent(eventData);
    }
    setIsModalOpen(false);
  };

  const handleEventClick = async (eventId: string) => {
    await getEvent(eventId);
  };

  const handleDeleteEvent = async () => {
    if (selectedEvent) {
      await deleteEvent(selectedEvent.id);
    }
  };

  const handleEditEvent = (event: any) => {
    setEditingEvent(event);
    setIsModalOpen(true);
  };

  const handleViewChange = (view: 'month' | 'week' | 'day') => {
    // View type change is handled through calendar navigation
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Calendar</h1>
          <button
            onClick={() => {
              setEditingEvent(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors"
          >
            + New Event
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-100">
            {error}
          </div>
        )}

        {/* Sync Status */}
        {isSyncing && (
          <div className="mb-6 p-4 bg-blue-900/50 border border-blue-700 rounded-lg text-blue-100">
            Syncing calendar...
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-2">
            <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
              <CalendarGrid
                events={events}
                currentDate={currentDate}
                viewType={viewType}
                isLoading={isLoading}
                onEventClick={handleEventClick}
                onDateChange={changeDate}
              />
            </div>
          </div>

          {/* Event Detail Sidebar */}
          <div>
            {selectedEvent ? (
              <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                <EventDetail
                  event={selectedEvent}
                  onEdit={handleEditEvent}
                  onDelete={handleDeleteEvent}
                  isDeleting={isCreating}
                />
              </div>
            ) : (
              <div className="bg-slate-900 rounded-lg border border-slate-700 p-6 text-center text-slate-400">
                <p>Select an event to view details</p>
              </div>
            )}
          </div>
        </div>

        {/* Create/Edit Event Modal */}
        {isModalOpen && (
          <CreateEventModal
            event={editingEvent}
            onSave={handleCreateEvent}
            onClose={() => {
              setIsModalOpen(false);
              setEditingEvent(null);
            }}
            isSaving={isCreating}
          />
        )}
      </div>
    </div>
  );
}
