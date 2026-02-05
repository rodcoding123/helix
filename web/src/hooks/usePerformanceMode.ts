import { useState, useEffect } from 'react';

type PerformanceMode = 'high' | 'medium' | 'low';

/**
 * Battery Manager API interface
 * Represents the Battery Status API for checking device battery level
 */
interface BatteryManager {
  level: number;
  charging: boolean;
}

/**
 * Extended Navigator interface with Battery API support
 */
interface NavigatorWithBattery extends Navigator {
  getBattery(): Promise<BatteryManager>;
}

/**
 * Hook to detect device performance capabilities and determine optimal animation settings
 * Returns 'high', 'medium', or 'low' based on:
 * - Mobile device detection
 * - Battery level (if available)
 * - Hardware concurrency (CPU cores)
 * - Device pixel ratio (screen density)
 */
export function usePerformanceMode(): PerformanceMode {
  const [mode, setMode] = useState<PerformanceMode>('high');

  useEffect(() => {
    // Check if mobile device
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    // Start with mobile detection
    let detectedMode: PerformanceMode = isMobile ? 'medium' : 'high';

    // Check battery level if available (Battery Status API)
    if ('getBattery' in navigator) {
      (navigator as NavigatorWithBattery)
        .getBattery()
        .then((battery: BatteryManager) => {
          if (battery.level < 0.2) {
            setMode('low');
          } else if (battery.level < 0.5) {
            detectedMode = 'medium';
            setMode(detectedMode);
          }
        })
        .catch((error) => {
          console.warn('Battery API unavailable:', error);
        });
    }

    // Check hardware concurrency (number of CPU cores)
    if (navigator.hardwareConcurrency) {
      if (navigator.hardwareConcurrency < 2) {
        detectedMode = 'low';
      } else if (navigator.hardwareConcurrency < 4) {
        detectedMode = 'medium';
      }
    }

    // Check device pixel ratio (Retina/high-DPI displays consume more power)
    if (isMobile && window.devicePixelRatio && window.devicePixelRatio > 2) {
      if (detectedMode === 'high') {
        detectedMode = 'medium';
      }
    }

    // Check for tablet (larger high-DPI device)
    const isTablet =
      isMobile &&
      Math.min(window.screen.width, window.screen.height) >= 600 &&
      window.devicePixelRatio >= 2;
    if (isTablet && detectedMode === 'high') {
      detectedMode = 'medium';
    }

    setMode(detectedMode);
  }, []); // Device capabilities don't change during session - runs once on mount

  return mode;
}
