import { useEffect, useState, useRef } from 'react';
import { APP_VERSION } from '../config/version';

interface VersionInfo {
  version: string;
  buildTime: string;
}

export function useVersionCheck(checkInterval: number = 30000) {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentVersionRef = useRef<string>(APP_VERSION);

  const checkVersion = async () => {
    try {
      setIsChecking(true);
      // Add cache-busting query param to ensure we get the latest version
      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
        },
      });

      if (!response.ok) {
        return; // Silently fail if version.json doesn't exist yet
      }

      const data: VersionInfo = await response.json();

      // Compare versions
      if (data.version && data.version !== currentVersionRef.current) {
        setUpdateAvailable(true);
        // Clear interval once update is detected
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } catch (error) {
      // Silently fail - don't interrupt user experience
      console.debug('Version check failed:', error);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Initial check after a short delay (let app load first)
    const initialTimeout = setTimeout(() => {
      checkVersion();
    }, 5000); // Wait 5 seconds after app loads

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      checkVersion();
    }, checkInterval);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkInterval]);

  const forceRefresh = () => {
    // Clear any cached data if needed
    window.location.reload();
  };

  return {
    updateAvailable,
    isChecking,
    forceRefresh,
    currentVersion: currentVersionRef.current,
  };
}

