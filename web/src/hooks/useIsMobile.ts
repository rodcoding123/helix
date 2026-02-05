/**
 * Mobile detection hook
 * Detects mobile devices by screen size and touch capability
 * Used to throttle animations and heavy operations on mobile
 */

import { useState, useEffect } from 'react';

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Initial check
    const checkMobile = (): void => {
      // Check screen width
      const isSmallScreen = window.innerWidth < 768;
      
      // Check touch capability
      const hasTouch =
        () =>
          !!window.matchMedia('(hover: none) and (pointer: coarse)').matches;

      // Check user agent for common mobile identifiers
      const isUserAgentMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        );

      setIsMobile(isSmallScreen || hasTouch() || isUserAgentMobile);
    };

    checkMobile();

    // Listen for orientation changes and window resizes
    const handleResize = (): void => {
      checkMobile();
    };

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return isMobile;
}
