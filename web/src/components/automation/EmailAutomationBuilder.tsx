/**
 * Email Automation Builder Component - Phase 7 Track 1
 * React UI for creating and managing email-to-task automation rules
 */

import React, { useState } from 'react';
import { getEmailTriggerService } from '../../services/automation-email-trigger';

interface EmailAutomationBuilderProps {
  userId: string;
  onRuleCreated?: (ruleId: string) => void;
}

export const EmailAutomationBuilder: React.FC<EmailAutomationBuilderProps> = ({
  userId,
  onRuleCreated,
}) => {
  const [emailFromFilters, setEmailFromFilters] = useState<string[]>(['']);
  const [subjectKeywords, setSubjectKeywords] = useState<string[]>(['']);
  const [bodyKeywords, setBodyKeywords] = useState<string[]>(['']);
  const [hasAttachments, setHasAttachments] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const emailTriggerService = getEmailTriggerService();

  const handleEmailFromChange = (index: number, value: string) => {
    const newFilters = [...emailFromFilters];
    newFilters[index] = value;
    setEmailFromFilters(newFilters);
  };

  const handleSubjectKeywordChange = (index: number, value: string) => {
    const newKeywords = [...subjectKeywords];
    newKeywords[index] = value;
    setSubjectKeywords(newKeywords);
  };

  const handleBodyKeywordChange = (index: number, value: string) => {
    const newKeywords = [...bodyKeywords];
    newKeywords[index] = value;
    setBodyKeywords(newKeywords);
  };

  const addEmailFromFilter = () => {
    setEmailFromFilters([...emailFromFilters, '']);
  };

  const removeEmailFromFilter = (index: number) => {
    setEmailFromFilters(emailFromFilters.filter((_, i) => i !== index));
  };

  const addSubjectKeyword = () => {
    setSubjectKeywords([...subjectKeywords, '']);
  };

  const removeSubjectKeyword = (index: number) => {
    setSubjectKeywords(subjectKeywords.filter((_, i) => i !== index));
  };

  const addBodyKeyword = () => {
    setBodyKeywords([...bodyKeywords, '']);
  };

  const removeBodyKeyword = (index: number) => {
    setBodyKeywords(bodyKeywords.filter((_, i) => i !== index));
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (!taskTitle.trim()) {
        throw new Error('Task title is required');
      }

      const filteredEmailFrom = emailFromFilters.filter((f) => f.trim());
      const filteredSubjectKeywords = subjectKeywords.filter((k) => k.trim());
      const filteredBodyKeywords = bodyKeywords.filter((k) => k.trim());

      const rule = await emailTriggerService.createEmailToTaskRule({
        userId,
        emailFrom: filteredEmailFrom.length > 0 ? filteredEmailFrom : undefined,
        subjectKeywords: filteredSubjectKeywords.length > 0 ? filteredSubjectKeywords : undefined,
        bodyKeywords: filteredBodyKeywords.length > 0 ? filteredBodyKeywords : undefined,
        hasAttachments: hasAttachments || undefined,
        createTaskConfig: {
          title: taskTitle,
          description: taskDescription || undefined,
          priority: taskPriority,
          dueDate: taskDueDate ? new Date(taskDueDate) : undefined,
        },
      });

      setSuccess(true);
      onRuleCreated?.(rule.id);

      // Reset form
      setEmailFromFilters(['']);
      setSubjectKeywords(['']);
      setBodyKeywords(['']);
      setTaskTitle('');
      setTaskDescription('');
      setTaskPriority('normal');
      setTaskDueDate('');
      setHasAttachments(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="email-automation-builder p-6 max-w-2xl">
      <h2 className="text-2xl font-bold mb-6">Create Email Automation Rule</h2>

      {error && <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>}
      {success && (
        <div className="mb-4 p-4 bg-green-100 text-green-700 rounded">
          Rule created successfully!
        </div>
      )}

      <form onSubmit={handleCreateRule} className="space-y-6">
        {/* Email Filters Section */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Email Filters</h3>

          {/* Email From */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">From Email Address</label>
            {emailFromFilters.map((filter, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="email"
                  value={filter}
                  onChange={(e) => handleEmailFromChange(index, e.target.value)}
                  placeholder="e.g., boss@company.com"
                  className="flex-1 px-3 py-2 border rounded"
                />
                {emailFromFilters.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEmailFromFilter(index)}
                    className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addEmailFromFilter}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add another email
            </button>
          </div>

          {/* Subject Keywords */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Subject Keywords</label>
            {subjectKeywords.map((keyword, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => handleSubjectKeywordChange(index, e.target.value)}
                  placeholder="e.g., urgent, important"
                  className="flex-1 px-3 py-2 border rounded"
                />
                {subjectKeywords.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSubjectKeyword(index)}
                    className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addSubjectKeyword}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add another keyword
            </button>
          </div>

          {/* Body Keywords */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Body Keywords</label>
            {bodyKeywords.map((keyword, index) => (
              <div key={index} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => handleBodyKeywordChange(index, e.target.value)}
                  placeholder="e.g., review, approval needed"
                  className="flex-1 px-3 py-2 border rounded"
                />
                {bodyKeywords.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBodyKeyword(index)}
                    className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addBodyKeyword}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              + Add another keyword
            </button>
          </div>

          {/* Attachments */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="hasAttachments"
              checked={hasAttachments}
              onChange={(e) => setHasAttachments(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="hasAttachments" className="text-sm font-medium">
              Email must have attachments
            </label>
          </div>
        </div>

        {/* Task Configuration Section */}
        <div className="border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Create Task</h3>

          {/* Task Title */}
          <div className="mb-4">
            <label htmlFor="taskTitle" className="block text-sm font-medium mb-2">
              Task Title *
            </label>
            <input
              id="taskTitle"
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g., Review {{emailSubject}}"
              className="w-full px-3 py-2 border rounded"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Use variables: {'{{emailSubject}}, {{emailFrom}}, {{emailBody}}'}
            </p>
          </div>

          {/* Task Description */}
          <div className="mb-4">
            <label htmlFor="taskDescription" className="block text-sm font-medium mb-2">
              Task Description
            </label>
            <textarea
              id="taskDescription"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="Optional task description"
              rows={3}
              className="w-full px-3 py-2 border rounded"
            />
          </div>

          {/* Task Priority */}
          <div className="mb-4">
            <label htmlFor="taskPriority" className="block text-sm font-medium mb-2">
              Priority
            </label>
            <select
              id="taskPriority"
              value={taskPriority}
              onChange={(e) => setTaskPriority(e.target.value as 'low' | 'normal' | 'high')}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Task Due Date */}
          <div className="mb-4">
            <label htmlFor="taskDueDate" className="block text-sm font-medium mb-2">
              Due Date
            </label>
            <input
              id="taskDueDate"
              type="date"
              value={taskDueDate}
              onChange={(e) => setTaskDueDate(e.target.value)}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-4">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 font-medium"
          >
            {isLoading ? 'Creating rule...' : 'Create Automation Rule'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmailAutomationBuilder;
