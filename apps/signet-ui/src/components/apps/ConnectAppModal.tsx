import React, { useState, useCallback, useMemo, useEffect, Suspense, lazy } from 'react';
import {
  Link2,
  Loader2,
  AlertCircle,
  Globe,
  Key,
  Shield,
  ClipboardPaste,
  Copy,
  Check,
  RefreshCw,
  Share2,
  ScanLine,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { KeyInfo, TrustLevel } from '@signet/types';
import { connectViaNostrconnect, generateConnectionToken } from '../../lib/api-client.js';
import {
  parseNostrconnectUri,
  formatPermission,
  truncatePubkey,
  type ParsedNostrconnect,
} from '../../lib/nostrconnect.js';
import styles from './ConnectAppModal.module.css';

// Lazy load QR scanner to reduce initial bundle size
const QRScanner = lazy(() => import('../shared/QRScanner.js').then(m => ({ default: m.QRScanner })));

interface ConnectAppModalProps {
  open: boolean;
  keys: KeyInfo[];
  onClose: () => void;
  /** Called on success. Warning is set if relay notification failed (partial success). */
  onSuccess: (warning?: string) => void;
}

const TRUST_LEVEL_OPTIONS: { value: TrustLevel; label: string; description: string }[] = [
  {
    value: 'reasonable',
    label: 'Reasonable (Recommended)',
    description: 'Auto-approves common operations like signing notes and reactions',
  },
  {
    value: 'paranoid',
    label: 'Paranoid',
    description: 'Requires manual approval for every request',
  },
  {
    value: 'full',
    label: 'Full Trust',
    description: 'Auto-approves all requests without prompting',
  },
];

type TabType = 'bunker' | 'nostrconnect';

export function ConnectAppModal({
  open,
  keys,
  onClose,
  onSuccess,
}: ConnectAppModalProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('bunker');

  // NostrConnect state
  const [uri, setUri] = useState('');
  const [appName, setAppName] = useState('');
  const [selectedKeyName, setSelectedKeyName] = useState('');
  const [trustLevel, setTrustLevel] = useState<TrustLevel>('reasonable');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);

  // Bunker URI state
  const [bunkerKeyName, setBunkerKeyName] = useState('');
  const [bunkerUri, setBunkerUri] = useState<string | null>(null);
  const [bunkerLoading, setBunkerLoading] = useState(false);
  const [bunkerError, setBunkerError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Parse URI whenever it changes
  const parseResult = useMemo(() => {
    if (!uri.trim()) return null;
    return parseNostrconnectUri(uri);
  }, [uri]);

  const parsedData: ParsedNostrconnect | null = parseResult?.success ? parseResult.data : null;

  // Get active keys for selection
  const activeKeys = useMemo(() => keys.filter((k) => k.status === 'online'), [keys]);

  // Auto-select first active key if none selected (for both tabs)
  useEffect(() => {
    if (activeKeys.length === 0) {
      if (selectedKeyName) setSelectedKeyName('');
      if (bunkerKeyName) setBunkerKeyName('');
    } else {
      if (!selectedKeyName || !activeKeys.some((k) => k.name === selectedKeyName)) {
        setSelectedKeyName(activeKeys[0].name);
      }
      if (!bunkerKeyName || !activeKeys.some((k) => k.name === bunkerKeyName)) {
        setBunkerKeyName(activeKeys[0].name);
      }
    }
  }, [selectedKeyName, bunkerKeyName, activeKeys]);

  // Auto-populate app name from URI if available
  useEffect(() => {
    if (parsedData?.name && !appName) {
      setAppName(parsedData.name);
    }
  }, [parsedData?.name, appName]);

  // Countdown timer for bunker URI
  useEffect(() => {
    if (!expiresAt) {
      setTimeLeft(null);
      return;
    }

    const updateTimeLeft = () => {
      const now = new Date();
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
      setTimeLeft(remaining);
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Generate bunker URI
  const generateBunkerUri = useCallback(async () => {
    if (!bunkerKeyName) return;

    setBunkerLoading(true);
    setBunkerError(null);
    setBunkerUri(null);
    setExpiresAt(null);

    try {
      const result = await generateConnectionToken(bunkerKeyName);
      if (result.ok && result.bunkerUri) {
        setBunkerUri(result.bunkerUri);
        if (result.expiresAt) {
          setExpiresAt(new Date(result.expiresAt));
        }
      } else {
        setBunkerError(result.error || 'Failed to generate bunker URI');
      }
    } catch (err) {
      setBunkerError(err instanceof Error ? err.message : 'Failed to generate bunker URI');
    } finally {
      setBunkerLoading(false);
    }
  }, [bunkerKeyName]);

  // Copy bunker URI to clipboard
  const copyBunkerUri = useCallback(async () => {
    if (!bunkerUri) return;
    try {
      await navigator.clipboard.writeText(bunkerUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied
    }
  }, [bunkerUri]);

  const handleConnect = useCallback(async () => {
    if (!parsedData || !selectedKeyName) return;

    setConnecting(true);
    setError(null);

    try {
      const result = await connectViaNostrconnect({
        uri,
        keyName: selectedKeyName,
        trustLevel,
        description: appName || undefined,
      });

      if (result.ok) {
        // Success - close modal and refresh apps
        // Pass warning if relay notification failed (partial success)
        const warning = result.connectResponseSent === false
          ? result.connectResponseError || 'Could not notify the app. It may take a moment for the app to recognize the connection.'
          : undefined;
        onSuccess(warning);
        handleClose();
      } else {
        setError(result.error ?? 'Failed to connect');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
    } finally {
      setConnecting(false);
    }
  }, [parsedData, selectedKeyName, trustLevel, uri, appName, onSuccess]);

  // Handle QR scan result
  const handleQRScan = useCallback((result: string) => {
    setUri(result);
    setShowScanner(false);
  }, []);

  // Filter for QR scanner - only accept nostrconnect:// URIs
  const qrFilter = useCallback((result: string) => {
    return result.startsWith('nostrconnect://');
  }, []);

  const handleClose = useCallback(() => {
    // Reset NostrConnect state
    setUri('');
    setAppName('');
    setSelectedKeyName('');
    setTrustLevel('reasonable');
    setError(null);
    setShowScanner(false);
    // Reset Bunker state
    setBunkerUri(null);
    setBunkerError(null);
    setExpiresAt(null);
    setCopied(false);
    // Reset tab
    setActiveTab('bunker');
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    },
    [handleClose]
  );

  if (!open) return null;

  const hasParseError = parseResult && !parseResult.success;
  const canConnect = parsedData && selectedKeyName && !connecting;
  const isExpired = timeLeft !== null && timeLeft <= 0;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className={styles.overlay} onClick={handleClose} onKeyDown={handleKeyDown}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-app-modal-title"
      >
        <div className={styles.header}>
          <div className={styles.icon}>
            {activeTab === 'bunker' ? <Share2 size={20} /> : <Link2 size={20} />}
          </div>
          <div>
            <h2 id="connect-app-modal-title" className={styles.title}>
              {activeTab === 'bunker' ? 'Bunker URI' : 'Connect via NostrConnect'}
            </h2>
            <p className={styles.subtitle}>
              {activeTab === 'bunker'
                ? 'Share this with your Nostr app'
                : 'Scan or paste from your Nostr app'}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'bunker' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('bunker')}
          >
            Bunker URI
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'nostrconnect' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('nostrconnect')}
          >
            NostrConnect
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'bunker' ? (
            /* Bunker URI Tab */
            <>
              {/* Key Selection */}
              <div className={styles.field}>
                <label htmlFor="bunker-key-select" className={styles.label}>
                  <Key size={14} />
                  Key to share
                </label>
                {activeKeys.length === 0 ? (
                  <p className={styles.noKeys}>No active keys. Unlock a key first.</p>
                ) : (
                  <select
                    id="bunker-key-select"
                    className={styles.select}
                    value={bunkerKeyName}
                    onChange={(e) => {
                      setBunkerKeyName(e.target.value);
                      // Clear existing URI when key changes
                      setBunkerUri(null);
                      setExpiresAt(null);
                    }}
                  >
                    {activeKeys.map((key) => (
                      <option key={key.name} value={key.name}>
                        {key.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* QR Code / Generate Button */}
              <div className={styles.qrSection}>
                {bunkerLoading ? (
                  <div className={styles.qrPlaceholder}>
                    <Loader2 size={32} className={styles.spinning} />
                    <span className={styles.loadingText}>Generating...</span>
                  </div>
                ) : bunkerError ? (
                  <div className={styles.qrPlaceholder}>
                    <AlertCircle size={32} className={styles.errorIcon} />
                    <span className={styles.errorText}>{bunkerError}</span>
                    <button
                      type="button"
                      className={styles.retryButton}
                      onClick={generateBunkerUri}
                    >
                      <RefreshCw size={14} />
                      Retry
                    </button>
                  </div>
                ) : bunkerUri ? (
                  <>
                    <div className={`${styles.qrContainer} ${isExpired ? styles.qrExpired : ''}`}>
                      <QRCodeSVG value={bunkerUri} size={200} />
                      {isExpired && (
                        <div className={styles.expiredOverlay}>
                          <span>Expired</span>
                        </div>
                      )}
                    </div>
                    {timeLeft !== null && (
                      <span className={timeLeft <= 30 ? styles.timerWarning : styles.timer}>
                        {isExpired ? 'Expired' : `Expires in ${formatTime(timeLeft)}`}
                      </span>
                    )}
                  </>
                ) : null}
              </div>

              {/* Bunker Actions */}
              <div className={styles.bunkerActions}>
                {bunkerUri && !isExpired ? (
                  <>
                    <button
                      type="button"
                      className={`${styles.secondaryButton} ${copied ? styles.copied : ''}`}
                      onClick={copyBunkerUri}
                    >
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? 'Copied!' : 'Copy URI'}
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      onClick={generateBunkerUri}
                    >
                      <RefreshCw size={16} />
                      Regenerate
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={generateBunkerUri}
                    disabled={!bunkerKeyName || bunkerLoading}
                  >
                    {isExpired ? (
                      <>
                        <RefreshCw size={16} />
                        Regenerate
                      </>
                    ) : (
                      <>
                        <Share2 size={16} />
                        Generate Bunker URI
                      </>
                    )}
                  </button>
                )}
              </div>

              <p className={styles.fieldHint}>
                Scan the QR code or paste the URI in your Nostr app to connect.
              </p>
            </>
          ) : (
            /* NostrConnect Tab */
            <>
              {/* QR Scanner */}
              {showScanner ? (
                <Suspense fallback={
                  <div className={styles.scannerLoading}>
                    <Loader2 size={24} className={styles.spinning} />
                    <span>Loading scanner...</span>
                  </div>
                }>
                  <QRScanner
                    onScan={handleQRScan}
                    onClose={() => setShowScanner(false)}
                    filter={qrFilter}
                    placeholder="Point your camera at a nostrconnect:// QR code"
                  />
                </Suspense>
              ) : (
                /* URI Input */
                <div className={styles.field}>
                  <div className={styles.inputActions}>
                    <button
                      type="button"
                      className={styles.actionButton}
                      onClick={() => setShowScanner(true)}
                      title="Scan QR code"
                      aria-label="Scan QR code"
                    >
                      <ScanLine size={16} />
                      Scan
                    </button>
                    <button
                      type="button"
                      className={styles.actionButton}
                      onClick={async () => {
                        try {
                          const text = await navigator.clipboard.readText();
                          if (text) setUri(text);
                        } catch {
                          // Clipboard access denied or unavailable
                        }
                      }}
                      title="Paste from clipboard"
                      aria-label="Paste from clipboard"
                    >
                      <ClipboardPaste size={16} />
                      Paste
                    </button>
                  </div>
                  <textarea
                    id="nostrconnect-uri"
                    className={`${styles.textarea} ${hasParseError ? styles.textareaError : ''}`}
                    value={uri}
                    onChange={(e) => setUri(e.target.value)}
                    placeholder="nostrconnect://..."
                    rows={3}
                    autoFocus
                  />
                  {hasParseError && (
                    <p className={styles.fieldError}>
                      <AlertCircle size={14} />
                      {parseResult.error.message}
                    </p>
                  )}
                </div>
              )}

              {/* Parsed Info */}
              {parsedData && (
                <>
                  {/* App Name Input */}
                  <div className={styles.field}>
                    <label htmlFor="app-name" className={styles.label}>
                      App Name
                    </label>
                    <input
                      id="app-name"
                      type="text"
                      className={styles.input}
                      value={appName}
                      onChange={(e) => setAppName(e.target.value)}
                      placeholder="Enter a name for this app"
                    />
                  </div>

                  {/* Client Info */}
                  <div className={styles.infoBox}>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Client</span>
                      <span className={styles.infoValue} title={parsedData.clientPubkey}>
                        {truncatePubkey(parsedData.clientPubkey)}
                      </span>
                    </div>
                    <div className={styles.infoRow}>
                      <span className={styles.infoLabel}>Relays</span>
                      <span className={styles.infoValue}>
                        {parsedData.relays.map((r) => r.replace('wss://', '')).join(', ')}
                      </span>
                    </div>
                    {parsedData.url && (
                      <div className={styles.infoRow}>
                        <span className={styles.infoLabel}>URL</span>
                        <a
                          href={parsedData.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.infoLink}
                        >
                          <Globe size={12} />
                          {parsedData.url.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Key Selection */}
                  <div className={styles.field}>
                    <label htmlFor="key-select" className={styles.label}>
                      <Key size={14} />
                      Sign with Key
                    </label>
                    {activeKeys.length === 0 ? (
                      <p className={styles.noKeys}>No active keys. Unlock a key first.</p>
                    ) : (
                      <select
                        id="key-select"
                        className={styles.select}
                        value={selectedKeyName}
                        onChange={(e) => setSelectedKeyName(e.target.value)}
                      >
                        {activeKeys.map((key) => (
                          <option key={key.name} value={key.name}>
                            {key.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Trust Level */}
                  <div className={styles.field}>
                    <label htmlFor="trust-level" className={styles.label}>
                      <Shield size={14} />
                      Trust Level
                    </label>
                    <select
                      id="trust-level"
                      className={styles.select}
                      value={trustLevel}
                      onChange={(e) => setTrustLevel(e.target.value as TrustLevel)}
                    >
                      {TRUST_LEVEL_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className={styles.fieldHint}>
                      {TRUST_LEVEL_OPTIONS.find((o) => o.value === trustLevel)?.description}
                    </p>
                  </div>

                  {/* Requested Permissions (informational) */}
                  {parsedData.permissions.length > 0 && (
                    <div className={styles.field}>
                      <span className={styles.label}>App is requesting</span>
                      <div className={styles.permissionsInfo}>
                        {parsedData.permissions.map((perm) => {
                          const key =
                            perm.kind !== undefined ? `${perm.method}:${perm.kind}` : perm.method;
                          return (
                            <span key={key} className={styles.permissionTag}>
                              {formatPermission(perm)}
                            </span>
                          );
                        })}
                      </div>
                      <p className={styles.fieldHint}>
                        These are what the app says it needs. Your trust level controls what actually gets auto-approved.
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Error */}
              {error && (
                <div className={styles.errorBox}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          <button type="button" className={styles.cancelButton} onClick={handleClose}>
            {activeTab === 'bunker' ? 'Close' : 'Cancel'}
          </button>
          {activeTab === 'nostrconnect' && (
            <button
              type="button"
              className={styles.connectButton}
              onClick={handleConnect}
              disabled={!canConnect}
            >
              {connecting ? (
                <>
                  <Loader2 size={16} className={styles.spinning} />
                  Connecting...
                </>
              ) : (
                'Connect'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
