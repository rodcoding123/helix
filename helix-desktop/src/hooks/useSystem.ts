/**
 * System information hook for Helix Desktop
 */

import { useState, useEffect, useCallback } from 'react';
import { invoke } from '../lib/tauri-compat';

export interface SystemInfo {
  os: string;
  arch: string;
  platform: string;
  node_version: string | null;
  helix_version: string;
}

export interface HelixPaths {
  home: string;
  helix_dir: string;
  config_path: string;
  psychology_dir: string;
  logs_dir: string;
  sessions_dir: string;
}

export function useSystem() {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [paths, setPaths] = useState<HelixPaths | null>(null);
  const [isFirstRun, setIsFirstRun] = useState<boolean | null>(null);

  const loadSystemInfo = useCallback(async () => {
    try {
      const info = await invoke<SystemInfo>('get_system_info');
      setSystemInfo(info);
    } catch (error) {
      console.error('Failed to load system info:', error);
    }
  }, []);

  const loadPaths = useCallback(async () => {
    try {
      const pathInfo = await invoke<HelixPaths>('get_helix_paths');
      setPaths(pathInfo);
    } catch (error) {
      console.error('Failed to load paths:', error);
    }
  }, []);

  const checkFirstRun = useCallback(async () => {
    try {
      const first = await invoke<boolean>('is_first_run');
      setIsFirstRun(first);
      return first;
    } catch (error) {
      console.error('Failed to check first run:', error);
      return true; // Assume first run on error
    }
  }, []);

  const markOnboarded = useCallback(async () => {
    try {
      await invoke('mark_onboarded');
      setIsFirstRun(false);
    } catch (error) {
      console.error('Failed to mark onboarded:', error);
      throw error;
    }
  }, []);

  useEffect(() => {
    loadSystemInfo();
    loadPaths();
    checkFirstRun();
  }, [loadSystemInfo, loadPaths, checkFirstRun]);

  return {
    systemInfo,
    paths,
    isFirstRun,
    loadSystemInfo,
    loadPaths,
    checkFirstRun,
    markOnboarded,
  };
}
