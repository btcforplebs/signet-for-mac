import { nip19 } from 'nostr-tools';

export const toNpub = (hex: string): string => {
  try {
    return nip19.npubEncode(hex);
  } catch {
    return hex;
  }
};

export const formatRelativeTime = (iso: string, now: number): string => {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) {
    return '';
  }

  const diffSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSeconds < 1) return 'just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w ago`;
};

/**
 * Format a timestamp as a simple time ago string (uses current time automatically)
 */
export const formatTimeAgo = (timestamp: string): string => {
  const diff = Date.now() - new Date(timestamp).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

/**
 * Format last active date in a human-friendly way
 */
export const formatLastActive = (date: string | null): string => {
  if (!date) return 'Never used';

  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);

  if (hours < 24) return 'Active today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (weeks === 1) return '1 week ago';
  if (weeks < 4) return `${weeks} weeks ago`;
  return new Date(date).toLocaleDateString();
};

/**
 * Check if a date is within the last 24 hours
 */
export const isActiveRecently = (date: string | null): boolean => {
  if (!date) return false;
  const diff = Date.now() - new Date(date).getTime();
  const hours = diff / (1000 * 60 * 60);
  return hours < 24;
};

/**
 * Format a future date as a compact string
 */
export const formatFutureDate = (date: string): string => {
  const d = new Date(date);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // If less than 24 hours, show time only
  if (diffHours < 24 && diffHours > 0) {
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  // If same year, show month/day + time
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  // Otherwise show full date
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Format uptime in seconds to a human-readable string.
 * Uses 2 significant units max, switches to months/years for long uptimes.
 * e.g., "45s", "5h 30m", "3d 12h", "2mo 15d", "1y 3mo"
 */
export const formatUptime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;

    const hours = Math.floor(seconds / 3600);
    if (hours < 24) {
        const mins = Math.floor((seconds % 3600) / 60);
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }

    const days = Math.floor(seconds / 86400);
    if (days < 30) {
        const hrs = Math.floor((seconds % 86400) / 3600);
        return hrs > 0 ? `${days}d ${hrs}h` : `${days}d`;
    }

    // 30+ days: use months
    const months = Math.floor(days / 30);
    if (days < 365) {
        const remainingDays = days % 30;
        return remainingDays > 0 ? `${months}mo ${remainingDays}d` : `${months}mo`;
    }

    // 365+ days: use years
    const years = Math.floor(days / 365);
    const remainingMonths = Math.floor((days % 365) / 30);
    return remainingMonths > 0 ? `${years}y ${remainingMonths}mo` : `${years}y`;
};

export const formatTtl = (seconds: number): string => {
  if (seconds <= 0) return 'Expired';
  if (seconds < 60) return `${seconds}s remaining`;
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}m ${secs.toString().padStart(2, '0')}s remaining`;
};

export const truncateContent = (content: string, maxLength: number = 200): string => {
  if (content.length <= maxLength) return content;
  return content.substring(0, maxLength) + '…';
};

export const buildErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
};

export interface HelpfulError {
  message: string;
  action?: string;
  canRetry?: boolean;
}

/**
 * Maps common error messages to helpful user-friendly versions
 */
export const getHelpfulErrorMessage = (error: string, context?: string): HelpfulError => {
  const errorLower = error.toLowerCase();

  // Key/passphrase related
  if (errorLower.includes('key is locked') || errorLower.includes('encrypted key')) {
    return {
      message: 'This key is locked',
      action: 'Enter the passphrase to unlock this key',
      canRetry: false,
    };
  }

  if (errorLower.includes('invalid password') || errorLower.includes('wrong password')) {
    return {
      message: 'Incorrect passphrase',
      action: 'Please check your passphrase and try again',
      canRetry: false,
    };
  }

  // Rate limiting
  if (errorLower.includes('rate limit') || errorLower.includes('too many requests') || errorLower.includes('429')) {
    return {
      message: 'Too many requests',
      action: 'Please wait a moment before trying again',
      canRetry: true,
    };
  }

  // Network errors
  if (errorLower.includes('network') || errorLower.includes('fetch') || errorLower.includes('no api endpoints')) {
    return {
      message: 'Unable to connect to server',
      action: 'Check your network connection and try again',
      canRetry: true,
    };
  }

  if (errorLower.includes('timeout')) {
    return {
      message: 'Request timed out',
      action: 'The server took too long to respond. Try again.',
      canRetry: true,
    };
  }

  // Authorization
  if (errorLower.includes('expired') || errorLower.includes('request expired')) {
    return {
      message: 'This request has expired',
      action: 'Ask the app to send a new request',
      canRetry: false,
    };
  }

  if (errorLower.includes('unauthorized') || errorLower.includes('authentication required') || errorLower.includes('401')) {
    return {
      message: 'Session expired',
      action: 'Please refresh the page and try again',
      canRetry: false,
    };
  }

  if (errorLower.includes('not found') || errorLower.includes('404')) {
    return {
      message: 'Request not found',
      action: 'This request may have already been processed',
      canRetry: false,
    };
  }

  // Server errors
  if (errorLower.includes('500') || errorLower.includes('internal server error')) {
    return {
      message: 'Server error',
      action: 'Please try again in a moment',
      canRetry: true,
    };
  }

  if (errorLower.includes('502') || errorLower.includes('bad gateway')) {
    return {
      message: 'Server is temporarily unavailable',
      action: 'Please try again in a few moments',
      canRetry: true,
    };
  }

  // Default - just return the error as-is
  return {
    message: error,
    canRetry: true,
  };
};
