/**
 * Hook for deep linking integration
 * Initializes deep link handlers and navigation
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  initializeDeepLinking,
  registerChatHandler,
  registerDeviceHandler,
  registerApprovalHandler,
  registerSettingsHandler,
  registerSynthesisHandler,
} from '../lib/deep-linking';

export function useDeepLink() {
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize deep linking
    initializeDeepLinking().catch(err => {
      console.error('Failed to initialize deep linking:', err);
    });

    // Register chat handler
    registerChatHandler(async (sessionId) => {
      navigate(`/chat/${sessionId}`);
    });

    // Register device handlers
    registerDeviceHandler(
      async (code) => {
        // Navigate to device pairing with code pre-filled
        navigate('/settings/devices', { state: { pairingCode: code } });
      },
      async (deviceId) => {
        // Navigate to device detail
        navigate(`/settings/devices/${deviceId}`);
      }
    );

    // Register approval handler
    registerApprovalHandler(async (requestId, decision) => {
      // Navigate to approvals dashboard
      navigate('/settings/security/approvals', { state: { selectedRequest: requestId, action: decision } });
    });

    // Register settings handler
    registerSettingsHandler(async (path) => {
      navigate(`/settings/${path}`);
    });

    // Register synthesis handler
    registerSynthesisHandler(async (synthesisType) => {
      navigate('/memory/synthesis', { state: { synthesisType } });
    });
  }, [navigate]);
}
