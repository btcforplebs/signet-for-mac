import React from 'react';
import type { TrustLevel } from '@signet/types';
import { useSettings } from '../../contexts/SettingsContext.js';
import { getTrustLevelInfo } from '../../lib/event-labels.js';
import styles from './SettingsPanel.module.css';

const TRUST_LEVELS: TrustLevel[] = ['paranoid', 'reasonable', 'full'];

type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

interface SettingsPanelProps {
  notificationPermission: NotificationPermissionState;
  onRequestNotificationPermission: () => void;
}

export function SettingsPanel({
  notificationPermission,
  onRequestNotificationPermission,
}: SettingsPanelProps) {
  const { settings, updateSettings } = useSettings();

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Settings</h2>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Default Trust Level</h3>
        <p className={styles.sectionDescription}>
          Pre-selected trust level when approving new app connections.
          You can still change this per-request.
        </p>

        <div className={styles.trustLevelOptions}>
          {TRUST_LEVELS.map((level) => {
            const info = getTrustLevelInfo(level);
            return (
              <label key={level} className={styles.trustLevelOption}>
                <input
                  type="radio"
                  name="defaultTrustLevel"
                  value={level}
                  checked={settings.defaultTrustLevel === level}
                  onChange={() => updateSettings({ defaultTrustLevel: level })}
                  className={styles.trustLevelRadio}
                />
                <span className={`${styles.trustLevelLabel} ${styles[level]}`}>
                  <info.Icon size={16} aria-hidden="true" />
                  <span className={styles.trustLevelName}>{info.label}</span>
                </span>
                <span className={styles.trustLevelDescription}>{info.description}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Notifications</h3>

        <div className={styles.setting}>
          <div className={styles.settingInfo}>
            <span className={styles.settingLabel}>Browser notifications</span>
            <span className={styles.settingDescription}>
              Get notified when new requests arrive
            </span>
          </div>

          {notificationPermission === 'unsupported' ? (
            <span className={styles.unsupported}>Not supported</span>
          ) : notificationPermission === 'denied' ? (
            <span className={styles.denied}>Blocked by browser</span>
          ) : notificationPermission === 'granted' ? (
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) => updateSettings({ notificationsEnabled: e.target.checked })}
                aria-label="Enable browser notifications"
              />
              <span className={styles.toggleSlider} />
            </label>
          ) : (
            <button
              type="button"
              className={styles.enableButton}
              onClick={onRequestNotificationPermission}
            >
              Enable
            </button>
          )}
        </div>
      </div>

      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>About</h3>
        <div className={styles.about}>
          <p>
            <strong>Signet</strong> is a NIP-46 remote signer for Nostr.
          </p>
          <p className={styles.version}>
            Version {__APP_VERSION__}
          </p>
          <p>
            <a
              href="https://github.com/Letdown2491/signet"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              GitHub Repository
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
