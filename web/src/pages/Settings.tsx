import { useState } from 'react';
import {
  User as UserIcon,
  Key,
  CreditCard,
  Bell,
  Shield,
  Trash2,
  ExternalLink,
  Copy,
  Eye,
  EyeOff,
  Check,
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { PRICING_TIERS } from '@/lib/types';
import type { Subscription } from '@/lib/types';

type SettingsTab = 'account' | 'api' | 'billing' | 'notifications' | 'security';

export function Settings() {
  const { user, signOut } = useAuth();
  const { subscription } = useSubscription();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  const tabs: { id: SettingsTab; label: string; icon: typeof UserIcon }[] = [
    { id: 'account', label: 'Account', icon: UserIcon },
    { id: 'api', label: 'API Keys', icon: Key },
    { id: 'billing', label: 'Billing', icon: CreditCard },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="py-8">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-slate-400">Manage your account and preferences</p>

        <div className="mt-8 flex gap-8">
          {/* Sidebar */}
          <nav className="w-48 flex-shrink-0">
            <ul className="space-y-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <li key={tab.id}>
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        activeTab === tab.id
                          ? 'bg-helix-500/20 text-helix-400'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Content */}
          <div className="flex-1">
            {activeTab === 'account' && <AccountSettings user={user} onSignOut={signOut} />}
            {activeTab === 'api' && <ApiSettings />}
            {activeTab === 'billing' && <BillingSettings subscription={subscription} />}
            {activeTab === 'notifications' && <NotificationSettings />}
            {activeTab === 'security' && <SecuritySettings />}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccountSettings({ user, onSignOut }: { user: User | null; onSignOut: () => void }) {
  const [email, setEmail] = useState(user?.email || '');

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Profile</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-helix-500 focus:ring-1 focus:ring-helix-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">User ID</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 text-sm font-mono">
                {user?.id || 'N/A'}
              </code>
              <button className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          <button className="btn btn-primary">Save Changes</button>
        </div>
      </div>

      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
        <h2 className="text-lg font-semibold text-white mb-2">Danger Zone</h2>
        <p className="text-sm text-slate-400 mb-4">
          These actions are irreversible. Please proceed with caution.
        </p>
        <div className="flex gap-3">
          <button onClick={onSignOut} className="btn btn-secondary">
            Sign Out
          </button>
          <button className="btn bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 inline-flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}

function ApiSettings() {
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const apiKey = 'hx_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">API Keys</h2>
        <p className="text-sm text-slate-400 mb-4">
          Use API keys to access the Helix Observatory programmatically.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Live API Key</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm font-mono">
                {showKey ? apiKey : '•'.repeat(40)}
              </code>
              <button
                onClick={() => setShowKey(!showKey)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
              <button
                onClick={copyKey}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="btn btn-primary">Generate New Key</button>
            <button className="btn btn-secondary">Revoke All Keys</button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Usage</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-slate-800/50">
            <p className="text-xs text-slate-500">API Calls (This Month)</p>
            <p className="text-2xl font-bold text-white">1,247</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-800/50">
            <p className="text-xs text-slate-500">Rate Limit</p>
            <p className="text-2xl font-bold text-white">1000/min</p>
          </div>
          <div className="p-4 rounded-lg bg-slate-800/50">
            <p className="text-xs text-slate-500">Last Used</p>
            <p className="text-2xl font-bold text-white">2h ago</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function BillingSettings({ subscription }: { subscription: Subscription | null }) {
  const currentTier = PRICING_TIERS.find(t => t.id === subscription?.tier) || PRICING_TIERS[0];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Current Plan</h2>

        <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 mb-4">
          <div>
            <p className="text-lg font-semibold text-white">{currentTier.name}</p>
            <p className="text-sm text-slate-400">${currentTier.price}/month</p>
          </div>
          <span className="px-3 py-1 rounded-full bg-helix-500/20 text-helix-400 text-sm">
            Active
          </span>
        </div>

        <div className="flex gap-3">
          <a href="/pricing" className="btn btn-primary">
            Change Plan
          </a>
          <button className="btn btn-secondary inline-flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Manage in Stripe
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Billing History</h2>
        <div className="space-y-3">
          <InvoiceItem date="Jan 1, 2026" amount={currentTier.price} status="paid" />
          <InvoiceItem date="Dec 1, 2025" amount={currentTier.price} status="paid" />
          <InvoiceItem date="Nov 1, 2025" amount={currentTier.price} status="paid" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Payment Method</h2>
        <div className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-700">
              <CreditCard className="h-5 w-5 text-slate-300" />
            </div>
            <div>
              <p className="text-sm text-white">•••• •••• •••• 4242</p>
              <p className="text-xs text-slate-500">Expires 12/27</p>
            </div>
          </div>
          <button className="text-sm text-helix-400 hover:text-helix-300">Update</button>
        </div>
      </div>
    </div>
  );
}

function InvoiceItem({ date, amount, status }: { date: string; amount: number; status: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
      <div>
        <p className="text-sm text-white">{date}</p>
        <p className="text-xs text-slate-500">Invoice</p>
      </div>
      <div className="text-right">
        <p className="text-sm text-white">${amount.toFixed(2)}</p>
        <span className="text-xs text-emerald-400 capitalize">{status}</span>
      </div>
    </div>
  );
}

function NotificationSettings() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [anomalyAlerts, setAnomalyAlerts] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);
  const [marketingEmails, setMarketingEmails] = useState(false);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Email Notifications</h2>

      <div className="space-y-4">
        <ToggleItem
          label="Email Notifications"
          description="Receive important updates via email"
          checked={emailNotifs}
          onChange={setEmailNotifs}
        />
        <ToggleItem
          label="Anomaly Alerts"
          description="Get notified when anomalies are detected"
          checked={anomalyAlerts}
          onChange={setAnomalyAlerts}
        />
        <ToggleItem
          label="Weekly Digest"
          description="Receive a weekly summary of your instances"
          checked={weeklyDigest}
          onChange={setWeeklyDigest}
        />
        <ToggleItem
          label="Marketing Emails"
          description="Receive news and product updates"
          checked={marketingEmails}
          onChange={setMarketingEmails}
        />
      </div>

      <button className="btn btn-primary mt-6">Save Preferences</button>
    </div>
  );
}

function ToggleItem({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-helix-500' : 'bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function SecuritySettings() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Password</h2>
        <p className="text-sm text-slate-400 mb-4">
          Change your password to keep your account secure.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Current Password
            </label>
            <input
              type="password"
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-helix-500 focus:ring-1 focus:ring-helix-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">New Password</label>
            <input
              type="password"
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-helix-500 focus:ring-1 focus:ring-helix-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Confirm New Password
            </label>
            <input
              type="password"
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 focus:border-helix-500 focus:ring-1 focus:ring-helix-500 outline-none"
            />
          </div>
          <button className="btn btn-primary">Update Password</button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Two-Factor Authentication</h2>
        <p className="text-sm text-slate-400 mb-4">
          Add an extra layer of security to your account.
        </p>
        <button className="btn btn-secondary inline-flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Enable 2FA
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Active Sessions</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
            <div>
              <p className="text-sm text-white">Current Session</p>
              <p className="text-xs text-slate-500">Chrome on Windows • Active now</p>
            </div>
            <span className="text-xs text-emerald-400">Current</span>
          </div>
        </div>
        <button className="btn btn-secondary mt-4">Sign Out All Other Sessions</button>
      </div>
    </div>
  );
}
