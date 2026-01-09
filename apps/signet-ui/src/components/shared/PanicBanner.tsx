import React from 'react';
import { AlertTriangle } from 'lucide-react';
import styles from './PanicBanner.module.css';

interface PanicBannerProps {
  visible: boolean;
  triggeredAt?: number | null;
}

export function PanicBanner({ visible, triggeredAt }: PanicBannerProps) {
  if (!visible) return null;

  const triggeredDate = triggeredAt ? new Date(triggeredAt * 1000) : null;
  const formattedDate = triggeredDate
    ? triggeredDate.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

  return (
    <div className={styles.banner} role="alert">
      <div className={styles.content}>
        <div className={styles.iconWrapper}>
          <AlertTriangle size={24} aria-hidden="true" />
        </div>
        <div className={styles.text}>
          <div className={styles.title}>Inactivity Lock Triggered</div>
          <div className={styles.description}>
            All keys have been locked and all apps suspended.
            {formattedDate && (
              <span className={styles.time}> Triggered {formattedDate}.</span>
            )}
          </div>
          <div className={styles.action}>
            Unlock keys and resume apps to recover access.
          </div>
        </div>
      </div>
    </div>
  );
}
