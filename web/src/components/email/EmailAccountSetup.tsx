/**
 * Email Account Setup Component
 * Phase 5 Track 1: OAuth2 and IMAP account configuration
 *
 * Features:
 * - Gmail OAuth2 integration
 * - Outlook OAuth2 integration
 * - Manual IMAP/SMTP setup
 * - Account testing and validation
 */

import React, { FC, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { emailAccountsService } from '@/services/email-accounts';
import { Mail, Lock, Settings, AlertCircle, CheckCircle } from 'lucide-react';

type SetupStep = 'provider-selection' | 'oauth-loading' | 'manual-setup' | 'test-connection' | 'success';
type SelectedProvider = 'gmail' | 'outlook' | 'imap' | null;

interface EmailAccountSetupProps {
  onAccountAdded?: (accountId: string) => void;
  onCancel?: () => void;
}

export const EmailAccountSetup: FC<EmailAccountSetupProps> = ({
  onAccountAdded,
  onCancel,
}) => {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState<SetupStep>('provider-selection');
  const [selectedProvider, setSelectedProvider] = useState<SelectedProvider>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manual setup state
  const [emailAddress, setEmailAddress] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState(993);
  const [imapUsername, setImapUsername] = useState('');
  const [imapPassword, setImapPassword] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');

  const handleGmailOAuth = async () => {
    try {
      setIsLoading(true);
      setSelectedProvider('gmail');
      setCurrentStep('oauth-loading');
      await emailAccountsService.startGmailOAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gmail OAuth failed');
      setCurrentStep('provider-selection');
      setIsLoading(false);
    }
  };

  const handleOutlookOAuth = async () => {
    try {
      setIsLoading(true);
      setSelectedProvider('outlook');
      setCurrentStep('oauth-loading');
      await emailAccountsService.startOutlookOAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Outlook OAuth failed');
      setCurrentStep('provider-selection');
      setIsLoading(false);
    }
  };

  const handleManualSetup = () => {
    setSelectedProvider('imap');
    setCurrentStep('manual-setup');
    // Pre-fill common values
    setImapUsername(emailAddress);
    setSmtpUsername(emailAddress);
  };

  const handleTestAndCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.id || !emailAddress) {
      setError('Missing required fields');
      return;
    }

    try {
      setIsLoading(true);
      setCurrentStep('test-connection');

      const account = await emailAccountsService.createManualEmailAccount(
        user.id,
        emailAddress,
        displayName,
        {
          host: imapHost,
          port: imapPort,
          secure: imapPort === 993,
          username: imapUsername,
          password: imapPassword,
        },
        {
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          username: smtpUsername,
          password: smtpPassword,
        }
      );

      setCurrentStep('success');
      onAccountAdded?.(account.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
      setCurrentStep('manual-setup');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="email-account-setup w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Mail className="w-6 h-6 text-blue-400" />
          Add Email Account
        </h2>
        <p className="text-slate-400 mt-1">Connect your email to Helix</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg flex gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Provider Selection */}
      {currentStep === 'provider-selection' && (
        <div className="space-y-4">
          <p className="text-slate-400 text-sm mb-4">Choose how to connect your email:</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Gmail Option */}
            <button
              onClick={handleGmailOAuth}
              disabled={isLoading}
              className="p-6 border-2 border-slate-700 rounded-lg hover:border-blue-500 hover:bg-blue-500/5 transition-all disabled:opacity-50 text-left group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">📧</span>
                <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                  OAuth2
                </span>
              </div>
              <h3 className="font-semibold text-slate-100 group-hover:text-blue-400">Gmail</h3>
              <p className="text-xs text-slate-500 mt-2">
                Secure OAuth2 login
              </p>
            </button>

            {/* Outlook Option */}
            <button
              onClick={handleOutlookOAuth}
              disabled={isLoading}
              className="p-6 border-2 border-slate-700 rounded-lg hover:border-blue-500 hover:bg-blue-500/5 transition-all disabled:opacity-50 text-left group"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">💼</span>
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded">
                  OAuth2
                </span>
              </div>
              <h3 className="font-semibold text-slate-100 group-hover:text-blue-400">
                Outlook
              </h3>
              <p className="text-xs text-slate-500 mt-2">
                Secure OAuth2 login
              </p>
            </button>

            {/* Manual IMAP/SMTP Option */}
            <button
              onClick={handleManualSetup}
              disabled={isLoading}
              className="p-6 border-2 border-slate-700 rounded-lg hover:border-purple-500 hover:bg-purple-500/5 transition-all disabled:opacity-50 text-left group sm:col-span-2"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-2xl">🔧</span>
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">
                  Manual Setup
                </span>
              </div>
              <h3 className="font-semibold text-slate-100 group-hover:text-purple-400">
                IMAP/SMTP
              </h3>
              <p className="text-xs text-slate-500 mt-2">
                Configure manually for any email provider
              </p>
            </button>
          </div>

          {/* Cancel Button */}
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full mt-4 py-2 px-4 text-slate-400 hover:text-slate-300 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}

      {/* OAuth Loading */}
      {currentStep === 'oauth-loading' && (
        <div className="text-center py-12 space-y-4">
          <div className="animate-spin text-4xl">🔄</div>
          <p className="text-slate-400">Redirecting to {selectedProvider}...</p>
          <p className="text-xs text-slate-500">
            You will be redirected to sign in securely
          </p>
        </div>
      )}

      {/* Manual Setup Form */}
      {currentStep === 'manual-setup' && (
        <form onSubmit={handleTestAndCreate} className="space-y-6">
          {/* Email Address */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              value={emailAddress}
              onChange={(e) => setEmailAddress(e.target.value)}
              required
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="your.email@example.com"
            />
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="Your Name"
            />
          </div>

          {/* IMAP Section */}
          <div className="border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5" />
              IMAP Settings
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  IMAP Host *
                </label>
                <input
                  type="text"
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 placeholder-slate-500"
                  placeholder="imap.gmail.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  IMAP Port *
                </label>
                <input
                  type="number"
                  value={imapPort}
                  onChange={(e) => setImapPort(parseInt(e.target.value))}
                  required
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
                  placeholder="993"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  IMAP Username *
                </label>
                <input
                  type="text"
                  value={imapUsername}
                  onChange={(e) => setImapUsername(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
                  placeholder="your.email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  IMAP Password *
                </label>
                <input
                  type="password"
                  value={imapPassword}
                  onChange={(e) => setImapPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {/* SMTP Section */}
          <div className="border-t border-slate-700 pt-6">
            <h3 className="text-lg font-semibold text-slate-100 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5" />
              SMTP Settings
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  SMTP Host *
                </label>
                <input
                  type="text"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  SMTP Port *
                </label>
                <input
                  type="number"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(parseInt(e.target.value))}
                  required
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
                  placeholder="587"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  SMTP Username *
                </label>
                <input
                  type="text"
                  value={smtpUsername}
                  onChange={(e) => setSmtpUsername(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
                  placeholder="your.email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  SMTP Password *
                </label>
                <input
                  type="password"
                  value={smtpPassword}
                  onChange={(e) => setSmtpPassword(e.target.value)}
                  required
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => {
                setCurrentStep('provider-selection');
                setSelectedProvider(null);
              }}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? '⟳ Testing...' : '✓ Test & Add Account'}
            </button>
          </div>
        </form>
      )}

      {/* Test Connection */}
      {currentStep === 'test-connection' && (
        <div className="text-center py-12 space-y-4">
          <div className="animate-spin text-4xl">⟳</div>
          <p className="text-slate-400">Testing connection...</p>
          <p className="text-xs text-slate-500">
            Verifying IMAP and SMTP settings
          </p>
        </div>
      )}

      {/* Success */}
      {currentStep === 'success' && (
        <div className="text-center py-12 space-y-4">
          <CheckCircle className="w-16 h-16 text-green-400 mx-auto" />
          <h3 className="text-xl font-semibold text-slate-100">Account Added!</h3>
          <p className="text-slate-400">
            Your email account has been successfully connected and is syncing.
          </p>
        </div>
      )}
    </div>
  );
};

export default EmailAccountSetup;
