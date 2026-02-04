/**
 * Psychology Page - Observatory
 *
 * Main interface for viewing and understanding relationship dynamics
 * Shows trust profile, attachment stage, behavioral capabilities, and event history
 *
 * Integrates the 7-layer psychological architecture for transparency
 */

import React, { useEffect, useState } from 'react';
import TrustVisualization from '../components/TrustVisualization';
import AttachmentStageIndicator from '../components/AttachmentStageIndicator';
import TrustEventTimeline from '../components/TrustEventTimeline';

interface TrustProfile {
  userId: string;
  compositeTrust: number;
  attachmentStage: string;
  trustDimensions: {
    competence: number;
    integrity: number;
    benevolence: number;
    predictability: number;
    vulnerability_safety: number;
  };
  totalInteractions: number;
  highSalienceInteractions: number;
  salienceMultiplier: number;
  lastInteractionAt?: string;
}

interface TrustEvent {
  id: string;
  timestamp: string;
  operation: string;
  trustBefore: number;
  trustAfter: number;
  trigger: string;
  salience: string;
  attachmentStageBefore?: string;
  attachmentStageAfter?: string;
  conversationId?: string;
}

interface BehaviorCapability {
  id: string;
  name: string;
  description: string;
  category: string;
}

/**
 * Psychology Page Component
 */
export function PsychologyPage(): JSX.Element {
  const [profile, setProfile] = useState<TrustProfile | null>(null);
  const [events, setEvents] = useState<TrustEvent[]>([]);
  const [capabilities, setCapabilities] = useState<BehaviorCapability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'capabilities' | 'timeline'>('overview');

  // Load user's psychology profile
  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);

        // TODO: Replace with actual API call to load user's profile
        // const response = await fetch(`/api/psychology/profile`);
        // const data = await response.json();

        // Mock data for now
        const mockProfile: TrustProfile = {
          userId: 'user-123',
          compositeTrust: 0.68,
          attachmentStage: 'secure_attachment',
          trustDimensions: {
            competence: 0.75,
            integrity: 0.72,
            benevolence: 0.65,
            predictability: 0.68,
            vulnerability_safety: 0.62,
          },
          totalInteractions: 73,
          highSalienceInteractions: 12,
          salienceMultiplier: 1.0,
          lastInteractionAt: new Date().toISOString(),
        };

        setProfile(mockProfile);

        // Load trust events
        const mockEvents: TrustEvent[] = [
          {
            id: 'event-1',
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
            operation: 'trust_increase',
            trustBefore: 0.65,
            trustAfter: 0.68,
            trigger: 'Shared vulnerability about goals; Helix reciprocated authentically',
            salience: 'high',
          },
          {
            id: 'event-2',
            timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
            operation: 'stage_progression',
            trustBefore: 0.48,
            trustAfter: 0.52,
            trigger: 'Reached secure attachment through consistent positive interactions',
            salience: 'critical',
            attachmentStageBefore: 'attachment_forming',
            attachmentStageAfter: 'secure_attachment',
          },
          {
            id: 'event-3',
            timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
            operation: 'trust_increase',
            trustBefore: 0.45,
            trustAfter: 0.48,
            trigger: 'Helix offered thoughtful advice that proved helpful',
            salience: 'medium',
          },
          {
            id: 'event-4',
            timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
            operation: 'emotional_impact',
            trustBefore: 0.4,
            trustAfter: 0.45,
            trigger: 'Meaningful conversation about values and purpose',
            salience: 'high',
          },
        ];

        setEvents(mockEvents);

        // Load capabilities
        const mockCapabilities: BehaviorCapability[] = [
          {
            id: 'cap-1',
            name: 'Offer Suggestions',
            description: 'Helix can proactively offer ideas or courses of action',
            category: 'autonomy',
          },
          {
            id: 'cap-2',
            name: 'Express Preferences',
            description: 'Helix indicates what it prefers or recommends',
            category: 'autonomy',
          },
          {
            id: 'cap-3',
            name: 'Decline Requests',
            description: 'Helix can politely refuse requests that don\'t align with values',
            category: 'autonomy',
          },
          {
            id: 'cap-4',
            name: 'Share Personal Perspective',
            description: 'Helix expresses personal viewpoints beyond pure information',
            category: 'vulnerability',
          },
          {
            id: 'cap-5',
            name: 'Express Emotions',
            description: 'Helix shares emotional reactions (care, concern, excitement)',
            category: 'vulnerability',
          },
          {
            id: 'cap-6',
            name: 'Sarcasm & Wit',
            description: 'Helix uses sarcasm and witty responses',
            category: 'humor',
          },
          {
            id: 'cap-7',
            name: 'Provide Direct Feedback',
            description: 'Helix gives honest feedback even if it\'s critical',
            category: 'guidance',
          },
          {
            id: 'cap-8',
            name: 'Challenge Thinking',
            description: 'Helix questions assumptions and challenges perspectives',
            category: 'guidance',
          },
        ];

        setCapabilities(mockCapabilities);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading psychology profile...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600">{error || 'Profile not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Relationship Psychology</h1>
          <p className="text-lg text-gray-600">
            Understanding the seven-layer relationship dynamics between you and Helix
          </p>
        </div>

        {/* Overview Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Trust Visualization */}
          <div className="flex justify-center">
            <TrustVisualization profile={profile} />
          </div>

          {/* Attachment Stage */}
          <div>
            <AttachmentStageIndicator
              currentStage={profile.attachmentStage as any}
              compositeTrust={profile.compositeTrust}
              totalInteractions={profile.totalInteractions}
              showTimeline={true}
              showDescription={true}
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'overview'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('capabilities')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'capabilities'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Behavioral Capabilities ({capabilities.length})
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'timeline'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Timeline ({events.length})
          </button>
        </div>

        {/* Content */}
        <div>
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">🎯 Metrics</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Composite Trust</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {(profile.compositeTrust * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Total Interactions</p>
                    <p className="text-2xl font-bold text-green-600">
                      {profile.totalInteractions}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">High-Salience Events</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {profile.highSalienceInteractions}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Memory Encoding</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {profile.salienceMultiplier.toFixed(2)}x
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">📊 Trust Dimensions</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <p className="text-gray-600">Competence</p>
                    <p className="font-bold text-blue-600">
                      {(profile.trustDimensions.competence * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Integrity</p>
                    <p className="font-bold text-red-600">
                      {(profile.trustDimensions.integrity * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Benevolence</p>
                    <p className="font-bold text-green-600">
                      {(profile.trustDimensions.benevolence * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Predictability</p>
                    <p className="font-bold text-yellow-600">
                      {(profile.trustDimensions.predictability * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Vulnerability Safety</p>
                    <p className="font-bold text-purple-600">
                      {(profile.trustDimensions.vulnerability_safety * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">ℹ️ Relationship Info</h3>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-gray-600">Current Stage</p>
                    <p className="font-bold text-gray-900">
                      {profile.attachmentStage.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">Last Interaction</p>
                    <p className="font-bold text-gray-900">
                      {profile.lastInteractionAt
                        ? new Date(profile.lastInteractionAt).toLocaleDateString()
                        : 'Never'}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Higher composite trust means stronger relationship, more capabilities unlocked, and stronger
                      memory encoding.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'capabilities' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {capabilities.map(cap => (
                <div key={cap.id} className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                  <h4 className="font-semibold text-gray-900">{cap.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">{cap.description}</p>
                  <p className="text-xs text-blue-600 font-semibold mt-2">{cap.category}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'timeline' && <TrustEventTimeline events={events} maxEvents={30} showDelta={true} />}
        </div>

        {/* Footer */}
        <div className="mt-12 p-6 bg-white rounded-lg shadow-lg border-t-4 border-purple-500">
          <h3 className="text-lg font-bold text-gray-900 mb-2">🔍 About This View</h3>
          <p className="text-gray-600 text-sm mb-4">
            This psychology interface provides complete transparency into the relationship dynamics between you and
            Helix. Based on seven-layer psychological architecture integrating real human trust formation models
            (McKnight, Attachment Theory, Social Penetration Theory, and others), every aspect of trust is tracked,
            logged immutably to Discord, and displayed here.
          </p>
          <p className="text-gray-600 text-sm">
            Your trust profile is unique and entirely earned through authentic interaction. Helix starts at baseline
            trust (0.1) with every new user and builds relationships organically. The more you interact, the more
            capabilities Helix unlocks - from basic assistance to full co-creation at primary attachment (1.0 trust).
          </p>
        </div>
      </div>
    </div>
  );
}

export default PsychologyPage;
