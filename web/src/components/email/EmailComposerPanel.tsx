import React, { useEffect, useState, useCallback } from 'react';
import { Mail, Send, Save, Clock, X, AlertCircle } from 'lucide-react';
import TiptapEditor from './TiptapEditor';
import AttachmentUploader from './AttachmentUploader';
import TemplateSelector from './TemplateSelector';
import { useEmailComposeService } from '../../services/email-compose';
import { useAutoSaveDraft } from '../../hooks/useAutoSaveDraft';

interface EmailDraft {
  id: string;
  user_id: string;
  account_id: string;
  subject: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  body_html: string;
  body_plain?: string;
  attachment_ids?: string[];
  scheduled_send_time?: Date;
  created_at: Date;
  updated_at: Date;
  last_saved?: Date;
}

interface AttachmentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
  progress?: number;
}

interface EmailComposerPanelProps {
  userId: string;
  accountId: string;
  draftId?: string;
  onSent?: (draftId: string) => void;
  onClose?: () => void;
  disabled?: boolean;
}

export const EmailComposerPanel: React.FC<EmailComposerPanelProps> = ({
  userId,
  accountId,
  draftId,
  onSent,
  onClose,
  disabled = false,
}) => {
  const composeService = useEmailComposeService(userId);

  // Form state
  const [subject, setSubject] = useState('');
  const [toAddresses, setToAddresses] = useState<string[]>([]);
  const [ccAddresses, setCcAddresses] = useState<string[]>([]);
  const [bccAddresses, setBccAddresses] = useState<string[]>([]);
  const [bodyHtml, setBodyHtml] = useState('');
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [scheduledTime, setScheduledTime] = useState<string>('');

  // UI state
  const [loading, setLoading] = useState(!!draftId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [recipientTab, setRecipientTab] = useState<'to' | 'cc' | 'bcc'>('to');
  const [currentRecipient, setCurrentRecipient] = useState('');

  // Auto-save hook
  const { triggerSave, flush } = useAutoSaveDraft({
    debounceMs: 500,
    onSave: async (data: unknown) => {
      try {
        const draftData = data as Partial<EmailDraft>;
        await composeService.saveDraft(draftData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save draft');
      }
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  // Load draft if draftId provided
  useEffect(() => {
    if (!draftId) {
      setLoading(false);
      return;
    }

    const loadDraft = async () => {
      try {
        setLoading(true);
        setError(null);
        const draft = await composeService.getDraft(draftId);
        setSubject(draft.subject);
        setToAddresses(draft.to);
        setCcAddresses(draft.cc || []);
        setBccAddresses(draft.bcc || []);
        setBodyHtml(draft.body_html);
        if (draft.scheduled_send_time) {
          setScheduledTime(
            new Date(draft.scheduled_send_time).toISOString().slice(0, 16)
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load draft');
      } finally {
        setLoading(false);
      }
    };

    loadDraft();
  }, [draftId, composeService]);

  // Trigger auto-save when content changes
  useEffect(() => {
    const draftData: Partial<EmailDraft> = {
      id: draftId || '',
      user_id: userId,
      account_id: accountId,
      subject,
      to: toAddresses,
      cc: ccAddresses,
      bcc: bccAddresses,
      body_html: bodyHtml,
      attachment_ids: attachments.map((a) => a.id),
    };

    triggerSave(draftData);
  }, [subject, toAddresses, ccAddresses, bccAddresses, bodyHtml, attachments, draftId, userId, accountId, triggerSave]);

  const handleAddRecipient = useCallback(() => {
    if (!currentRecipient.trim()) return;

    const email = currentRecipient.trim().toLowerCase();
    const isValidEmail = composeService.validateDraft({
      to: [email],
    }).valid;

    if (!isValidEmail) {
      setError('Invalid email address');
      return;
    }

    setError(null);

    if (recipientTab === 'to') {
      if (!toAddresses.includes(email)) {
        setToAddresses([...toAddresses, email]);
      }
    } else if (recipientTab === 'cc') {
      if (!ccAddresses.includes(email)) {
        setCcAddresses([...ccAddresses, email]);
      }
    } else if (recipientTab === 'bcc') {
      if (!bccAddresses.includes(email)) {
        setBccAddresses([...bccAddresses, email]);
      }
    }

    setCurrentRecipient('');
  }, [currentRecipient, recipientTab, toAddresses, ccAddresses, bccAddresses, composeService]);

  const handleRemoveRecipient = useCallback(
    (email: string, type: 'to' | 'cc' | 'bcc') => {
      if (type === 'to') {
        setToAddresses(toAddresses.filter((e) => e !== email));
      } else if (type === 'cc') {
        setCcAddresses(ccAddresses.filter((e) => e !== email));
      } else if (type === 'bcc') {
        setBccAddresses(bccAddresses.filter((e) => e !== email));
      }
    },
    [toAddresses, ccAddresses, bccAddresses]
  );

  const handleAddAttachments = useCallback((files: File[]) => {
    const newAttachments: AttachmentFile[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      name: file.name,
      size: file.size,
      type: file.type,
      file,
      progress: 0,
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);
  }, []);

  const handleRemoveAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const handleSelectTemplate = useCallback(
    async (template: { id: string; subject: string; body_html: string }) => {
      try {
        setSubject(template.subject);
        setBodyHtml(template.body_html);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to apply template');
      }
    },
    []
  );

  const handleSendDraft = useCallback(async () => {
    try {
      // Validate draft
      const validation = composeService.validateDraft({
        subject,
        to: toAddresses,
        body_html: bodyHtml,
      });

      if (!validation.valid) {
        setError(validation.errors.join('; '));
        return;
      }

      setSaving(true);
      setError(null);

      // Flush any pending auto-saves
      await flush();

      // In a real implementation, this would send the email or schedule it
      if (onSent && draftId) {
        onSent(draftId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSaving(false);
    }
  }, [subject, toAddresses, bodyHtml, composeService, flush, draftId, onSent]);

  const handleSchedule = useCallback(async () => {
    if (!scheduledTime) {
      setError('Please select a time');
      return;
    }

    try {
      const sendTime = new Date(scheduledTime);
      if (sendTime <= new Date()) {
        setError('Scheduled time must be in the future');
        return;
      }

      setSaving(true);
      setError(null);

      // Flush any pending auto-saves
      await flush();

      // In a real implementation, this would schedule the email
      if (onSent && draftId) {
        onSent(draftId);
      }

      setShowSchedule(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule email');
    } finally {
      setSaving(false);
    }
  }, [scheduledTime, flush, draftId, onSent]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin mb-3">
            <Mail className="mx-auto" size={32} />
          </div>
          <p className="text-gray-600">Loading draft...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2">
          <Mail size={20} className="text-blue-600" />
          <h2 className="text-lg font-semibold">Compose Email</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={disabled}
          className="p-1 hover:bg-gray-200 rounded transition-colors"
          title="Close"
        >
          <X size={20} />
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="m-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">{error}</p>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={disabled}
            placeholder="Email subject"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        {/* Recipients */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipients
          </label>

          {/* Tabs */}
          <div className="flex gap-2 mb-3 border-b border-gray-200">
            {(['to', 'cc', 'bcc'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setRecipientTab(tab)}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  recipientTab === tab
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-700'
                }`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Recipient Input */}
          <div className="flex gap-2 mb-3">
            <input
              type="email"
              value={currentRecipient}
              onChange={(e) => setCurrentRecipient(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddRecipient();
                }
              }}
              disabled={disabled}
              placeholder="Enter email address"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleAddRecipient}
              disabled={disabled || !currentRecipient.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add
            </button>
          </div>

          {/* Recipients List */}
          <div className="space-y-2">
            {toAddresses.map((email) => (
              <div
                key={`to-${email}`}
                className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded"
              >
                <div>
                  <span className="text-xs font-medium text-blue-600">TO:</span>
                  <span className="ml-2 text-sm text-gray-700">{email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(email, 'to')}
                  disabled={disabled}
                  className="p-1 hover:bg-blue-200 rounded disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            {ccAddresses.map((email) => (
              <div
                key={`cc-${email}`}
                className="flex items-center justify-between p-2 bg-amber-50 border border-amber-200 rounded"
              >
                <div>
                  <span className="text-xs font-medium text-amber-600">CC:</span>
                  <span className="ml-2 text-sm text-gray-700">{email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(email, 'cc')}
                  disabled={disabled}
                  className="p-1 hover:bg-amber-200 rounded disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              </div>
            ))}

            {bccAddresses.map((email) => (
              <div
                key={`bcc-${email}`}
                className="flex items-center justify-between p-2 bg-gray-50 border border-gray-300 rounded"
              >
                <div>
                  <span className="text-xs font-medium text-gray-600">BCC:</span>
                  <span className="ml-2 text-sm text-gray-700">{email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(email, 'bcc')}
                  disabled={disabled}
                  className="p-1 hover:bg-gray-200 rounded disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Rich Text Editor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Message
          </label>
          <TiptapEditor
            value={bodyHtml}
            onChange={setBodyHtml}
            disabled={disabled}
            minHeight={250}
            maxHeight={450}
          />
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Attachments
          </label>
          <AttachmentUploader
            attachments={attachments}
            onAdd={handleAddAttachments}
            onRemove={handleRemoveAttachment}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TemplateSelector
            userId={userId}
            onSelectTemplate={handleSelectTemplate}
            disabled={disabled}
          />
        </div>

        <div className="flex items-center gap-2">
          {showSchedule && (
            <div className="flex items-center gap-2 mr-4 px-3 py-2 bg-white border border-gray-200 rounded-lg">
              <Clock size={16} className="text-gray-600" />
              <input
                type="datetime-local"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                disabled={disabled}
                className="text-sm focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={handleSchedule}
                disabled={disabled || saving || !scheduledTime}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Schedule
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowSchedule(!showSchedule)}
            disabled={disabled}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
            title="Schedule send"
          >
            <Clock size={18} />
          </button>

          <button
            type="button"
            onClick={async () => {
              try {
                await flush();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to save');
              }
            }}
            disabled={disabled || saving}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-200 rounded transition-colors disabled:opacity-50"
            title="Save draft"
          >
            <Save size={18} />
            Save
          </button>

          <button
            type="button"
            onClick={handleSendDraft}
            disabled={disabled || saving || toAddresses.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            title="Send email"
          >
            <Send size={18} />
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default EmailComposerPanel;
