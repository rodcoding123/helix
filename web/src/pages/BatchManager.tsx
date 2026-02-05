/**
 * Phase 9B Week 24: Batch Manager Page
 * UI for creating and managing batch operations
 */

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getBatchExecutor } from '../services/batching/batch-executor';
import type { BatchStatus } from '../services/batching/batch-executor';

export function BatchManager(): React.ReactElement {
  const db = createClient(
    import.meta.env.VITE_SUPABASE_URL || '',
    import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  );

  const [batches, setBatches] = useState<BatchStatus[]>([]);
  const [showNewBatch, setShowNewBatch] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<BatchStatus | null>(null);

  const PHASE_8_OPERATIONS = [
    { id: 'email-compose', name: 'Email Composition' },
    { id: 'email-classify', name: 'Email Classification' },
    { id: 'email-respond', name: 'Response Suggestions' },
    { id: 'calendar-prep', name: 'Meeting Preparation' },
    { id: 'calendar-time', name: 'Optimal Meeting Times' },
    { id: 'task-prioritize', name: 'Task Prioritization' },
    { id: 'task-breakdown', name: 'Task Breakdown' },
    { id: 'analytics-summary', name: 'Weekly Summary' },
    { id: 'analytics-anomaly', name: 'Pattern Anomalies' },
  ];

  useEffect(() => {
    const initUser = async () => {
      const { data: session } = await db.auth.getSession() as any;
      if ((session as any)?.user?.id) {
        setUserId((session as any).user.id);
        const executor = getBatchExecutor();
        const history = await executor.getBatchHistory((session as any).user.id, 20);
        setBatches(history);
      }
    };

    initUser();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Batch Operations</h1>
          <p className="text-gray-600 mt-2">Execute multiple AI operations together</p>
        </div>
        <button
          onClick={() => setShowNewBatch(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          + New Batch
        </button>
      </div>

      <div className="grid gap-4">
        {batches.length === 0 ? (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <p className="text-gray-500">No batches yet</p>
          </div>
        ) : (
          batches.map(batch => (
            <div
              key={batch.id}
              onClick={() => setSelectedBatch(batch)}
              className="p-4 border rounded-lg hover:shadow-lg cursor-pointer transition bg-white"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{batch.name}</h3>
                  <p className="text-sm text-gray-600">{batch.batch_type}</p>
                </div>
                <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                  {batch.status}
                </span>
              </div>
              <div className="mt-3 text-xs text-gray-600">
                {batch.completed_operations} / {batch.total_operations} operations
              </div>
            </div>
          ))
        )}
      </div>

      {showNewBatch && (
        <NewBatchDialog
          operations={PHASE_8_OPERATIONS}
          onCreate={async () => {
            setShowNewBatch(false);
            // Reload batches
            if (userId) {
              const executor = getBatchExecutor();
              const history = await executor.getBatchHistory(userId, 20);
              setBatches(history);
            }
          }}
          onCancel={() => setShowNewBatch(false)}
        />
      )}

      {selectedBatch && (
        <BatchDetailModal batch={selectedBatch} onClose={() => setSelectedBatch(null)} />
      )}
    </div>
  );
}

interface NewBatchDialogProps {
  operations: Array<{ id: string; name: string }>;
  onCreate: () => Promise<void>;
  onCancel: () => void;
}

function NewBatchDialog({ operations, onCreate, onCancel }: NewBatchDialogProps) {
  const [batchType, setBatchType] = useState<'parallel' | 'sequential' | 'conditional'>(
    'parallel'
  );
  const [selectedOps, setSelectedOps] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await onCreate();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Create Batch</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Batch Type</label>
            <select
              value={batchType}
              onChange={e =>
                setBatchType(e.target.value as 'parallel' | 'sequential' | 'conditional')
              }
              className="w-full border rounded px-3 py-2"
            >
              <option value="parallel">Parallel (5 concurrent)</option>
              <option value="sequential">Sequential</option>
              <option value="conditional">Conditional (with dependencies)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Operations</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {operations.map(op => (
                <label key={op.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedOps.includes(op.id)}
                    onChange={e => {
                      if (e.target.checked) {
                        setSelectedOps([...selectedOps, op.id]);
                      } else {
                        setSelectedOps(selectedOps.filter(o => o !== op.id));
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm">{op.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border rounded hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isCreating || selectedOps.length === 0}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface BatchDetailModalProps {
  batch: BatchStatus;
  onClose: () => void;
}

function BatchDetailModal({ batch, onClose }: BatchDetailModalProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h2 className="text-2xl font-bold mb-4">{batch.name}</h2>

        <div className="space-y-3 mb-6">
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="font-semibold">{batch.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Type</p>
            <p className="font-semibold">{batch.batch_type}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Progress</p>
            <p className="font-semibold">
              {batch.completed_operations} / {batch.total_operations}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Cost</p>
            <p className="font-semibold">${batch.total_cost_actual?.toFixed(4) || '0.0000'}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 border rounded hover:bg-gray-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default BatchManager;
