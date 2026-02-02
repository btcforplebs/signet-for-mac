import React, { createContext, useContext, useState, useEffect } from 'react';
import type { TrustLevel } from '@signet/types';
import { checkBiometricAvailability } from '../lib/biometric.js';

export interface UserSettings {
  notificationsEnabled: boolean;
  defaultTrustLevel: TrustLevel;
  isStandalone: boolean;
  daemonUrl: string;
  biometricsEnabled: boolean;
  biometricType?: string;
}

export const isCapacitor = typeof window !== 'undefined' &&
  ((window as any).Capacitor?.isNative ||
    navigator.userAgent.includes('Capacitor') ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && window.location.port === ''));

const DEFAULT_SETTINGS: UserSettings = {
  notificationsEnabled: true,
  defaultTrustLevel: 'reasonable',
  isStandalone: isCapacitor,
  daemonUrl: '',
  biometricsEnabled: false,
};

const STORAGE_KEY = 'signet_settings';

export const isStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;

  const saved = localStorage.getItem(STORAGE_KEY);

  // Debug info
  const envInfo = {
    protocol: window.location.protocol,
    hostname: window.location.hostname,
    port: window.location.port,
    isNative: (window as any).Capacitor?.isNative,
    userAgent: navigator.userAgent
  };

  if (!saved) {
    console.log('[Settings] No settings. Env:', envInfo, 'Defaulting to:', isCapacitor);
    return isCapacitor;
  }

  try {
    const parsed = JSON.parse(saved);

    // Force standalone on mobile if no daemon URL is set, 
    // regardless of what the stale isStandalone flag says.
    let result = parsed.isStandalone;
    const isCap = isCapacitor;

    if (isCap && !parsed.daemonUrl) {
      result = true;
    } else if (result === undefined) {
      result = isCap;
    }

    console.log('[Settings] isStandalone check:', result, 'isCapacitor:', isCap, 'Env:', envInfo);
    return result;
  } catch (e) {
    console.log('[Settings] Error parsing. Fallback to:', isCapacitor);
    return isCapacitor;
  }
};

interface SettingsContextValue {
  settings: UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadSettings(): UserSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return DEFAULT_SETTINGS;

  try {
    const parsed = JSON.parse(saved);
    return {
      notificationsEnabled: parsed.notificationsEnabled ?? DEFAULT_SETTINGS.notificationsEnabled,
      defaultTrustLevel: parsed.defaultTrustLevel ?? DEFAULT_SETTINGS.defaultTrustLevel,
      isStandalone: parsed.isStandalone ?? DEFAULT_SETTINGS.isStandalone,
      daemonUrl: parsed.daemonUrl ?? DEFAULT_SETTINGS.daemonUrl,
      biometricsEnabled: parsed.biometricsEnabled ?? DEFAULT_SETTINGS.biometricsEnabled,
      biometricType: parsed.biometricType,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<UserSettings>(loadSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Check biometric availability on mount
  useEffect(() => {
    if (isCapacitor) {
      checkBiometricAvailability().then(result => {
        if (result.available) {
          // Store the numeric value or string name
          updateSettings({ biometricType: String(result.biometryType) });
        }
      });
    }
  }, []);

  const updateSettings = (updates: Partial<UserSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
