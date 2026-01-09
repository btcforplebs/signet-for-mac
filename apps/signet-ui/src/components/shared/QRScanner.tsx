import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Camera, X, AlertCircle } from 'lucide-react';
import styles from './QRScanner.module.css';

interface QRScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
  /** Optional filter to validate scanned content before accepting */
  filter?: (result: string) => boolean;
  /** Placeholder text shown when no camera is active */
  placeholder?: string;
}

export function QRScanner({
  onScan,
  onClose,
  filter,
  placeholder = 'Point your camera at a QR code',
}: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      } catch {
        // Ignore errors during cleanup
      }
      scannerRef.current = null;
    }
  }, []);

  const handleSuccess = useCallback(
    (decodedText: string) => {
      // If filter provided, check if result is valid
      if (filter && !filter(decodedText)) {
        return; // Keep scanning
      }
      onScan(decodedText);
    },
    [onScan, filter]
  );

  useEffect(() => {
    const elementId = 'qr-scanner-viewport';

    const startScanner = async () => {
      setIsStarting(true);
      setError(null);

      try {
        const html5QrCode = new Html5Qrcode(elementId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          handleSuccess,
          () => {
            // Ignore scan failures (no QR code in frame)
          }
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to start camera';
        if (message.includes('Permission')) {
          setError('Camera permission denied. Please allow camera access and try again.');
        } else if (message.includes('NotFoundError') || message.includes('no camera')) {
          setError('No camera found. Please connect a camera and try again.');
        } else {
          setError(message);
        }
      } finally {
        setIsStarting(false);
      }
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, [handleSuccess, stopScanner]);

  const handleClose = useCallback(async () => {
    await stopScanner();
    onClose();
  }, [stopScanner, onClose]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.title}>
          <Camera size={16} />
          Scan QR Code
        </span>
        <button
          type="button"
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="Close scanner"
        >
          <X size={18} />
        </button>
      </div>

      <div className={styles.viewport} ref={containerRef}>
        <div id="qr-scanner-viewport" className={styles.scanner} />

        {isStarting && (
          <div className={styles.overlay}>
            <span className={styles.overlayText}>Starting camera...</span>
          </div>
        )}

        {error && (
          <div className={styles.errorOverlay}>
            <AlertCircle size={24} />
            <span className={styles.errorText}>{error}</span>
            <button type="button" className={styles.retryButton} onClick={handleClose}>
              Close
            </button>
          </div>
        )}
      </div>

      <p className={styles.hint}>{placeholder}</p>
    </div>
  );
}
