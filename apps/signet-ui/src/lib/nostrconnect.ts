/**
 * Simple nostrconnect:// URI parser for the UI.
 * Full validation is done by the daemon.
 */

export interface NostrconnectPermission {
  method: string;
  kind?: number;
}

export interface ParsedNostrconnect {
  clientPubkey: string;
  relays: string[];
  secret: string;
  permissions: NostrconnectPermission[];
  name?: string;
  url?: string;
}

export interface NostrconnectParseError {
  type: string;
  message: string;
}

export type NostrconnectParseResult =
  | { success: true; data: ParsedNostrconnect }
  | { success: false; error: NostrconnectParseError };

/**
 * Parse a nostrconnect:// URI for display purposes.
 * Returns parsed data or error info.
 */
export function parseNostrconnectUri(uri: string): NostrconnectParseResult {
  const trimmed = uri.trim();

  if (!trimmed.startsWith('nostrconnect://')) {
    return {
      success: false,
      error: {
        type: 'invalid_scheme',
        message: 'URI must start with nostrconnect://',
      },
    };
  }

  // Extract the part after the scheme
  const withoutScheme = trimmed.slice('nostrconnect://'.length);

  if (!withoutScheme || withoutScheme.startsWith('?')) {
    return {
      success: false,
      error: {
        type: 'missing_pubkey',
        message: 'Client pubkey is required',
      },
    };
  }

  // Parse using URL API
  let parsed: URL;
  try {
    parsed = new URL(trimmed.replace('nostrconnect://', 'https://'));
  } catch {
    return {
      success: false,
      error: {
        type: 'invalid_format',
        message: 'Invalid URI format',
      },
    };
  }

  const clientPubkey = parsed.hostname.toLowerCase();

  if (!/^[0-9a-f]{64}$/.test(clientPubkey)) {
    return {
      success: false,
      error: {
        type: 'invalid_pubkey',
        message: 'Client pubkey must be 64 hex characters',
      },
    };
  }

  const rawRelays = parsed.searchParams.getAll('relay');
  if (rawRelays.length === 0) {
    return {
      success: false,
      error: {
        type: 'missing_relay',
        message: 'At least one relay is required',
      },
    };
  }

  // Validate and normalize relays
  const relays: string[] = [];
  const invalidRelays: string[] = [];
  for (const relay of rawRelays) {
    const normalized = normalizeRelay(relay);
    if (normalized) {
      relays.push(normalized);
    } else if (relay.trim()) {
      invalidRelays.push(relay);
    }
  }

  if (relays.length === 0) {
    const invalidList = invalidRelays.length > 0 ? `: ${invalidRelays.join(', ')}` : '';
    return {
      success: false,
      error: {
        type: 'invalid_relay',
        message: `No valid relay URLs${invalidList}`,
      },
    };
  }

  const secret = parsed.searchParams.get('secret');
  if (!secret) {
    return {
      success: false,
      error: {
        type: 'missing_secret',
        message: 'Secret is required for secure connections',
      },
    };
  }

  // Optional fields
  const name = parsed.searchParams.get('name') || undefined;
  const url = parsed.searchParams.get('url') || undefined;

  // Parse permissions
  const permsParam = parsed.searchParams.get('perms');
  const permissions = parsePermissions(permsParam);

  return {
    success: true,
    data: {
      clientPubkey,
      relays,
      secret,
      permissions,
      name,
      url,
    },
  };
}

const WSS_RELAY_REGEX = /^wss?:\/\/.+/i;

/**
 * Normalize and validate a relay URL.
 * Returns the normalized URL or null if invalid.
 */
function normalizeRelay(relay: string): string | null {
  const trimmed = relay.trim();
  if (!trimmed) return null;

  // Add wss:// if no scheme
  const normalized = trimmed.startsWith('wss://') || trimmed.startsWith('ws://')
    ? trimmed
    : `wss://${trimmed}`;

  // Validate the URL format
  if (!WSS_RELAY_REGEX.test(normalized)) {
    return null;
  }

  // Try to parse as URL to catch malformed URLs
  try {
    new URL(normalized);
    return normalized;
  } catch {
    return null;
  }
}

function parsePermissions(permsParam: string | null): NostrconnectPermission[] {
  if (!permsParam) return [];

  const permissions: NostrconnectPermission[] = [];
  const parts = permsParam.split(',');

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    if (trimmed.includes(':')) {
      const [method, kindStr] = trimmed.split(':');
      const kind = parseInt(kindStr, 10);
      if (!isNaN(kind)) {
        permissions.push({ method: method.trim(), kind });
      } else {
        permissions.push({ method: method.trim() });
      }
    } else {
      permissions.push({ method: trimmed });
    }
  }

  return permissions;
}

/**
 * Format a permission for display.
 */
export function formatPermission(perm: NostrconnectPermission): string {
  const methodLabels: Record<string, string> = {
    'sign_event': 'Sign events',
    'nip04_encrypt': 'NIP-04 encryption',
    'nip04_decrypt': 'NIP-04 decryption',
    'nip44_encrypt': 'NIP-44 encryption',
    'nip44_decrypt': 'NIP-44 decryption',
    'get_public_key': 'Get public key',
    'connect': 'Connect',
    'ping': 'Ping',
  };

  const kindLabels: Record<number, string> = {
    0: 'profile metadata',
    1: 'notes',
    3: 'contact list',
    4: 'DMs (NIP-04)',
    6: 'reposts',
    7: 'reactions',
    9734: 'zap requests',
    9735: 'zap receipts',
    10002: 'relay list',
    30023: 'long-form content',
  };

  const baseLabel = methodLabels[perm.method] || perm.method;

  if (perm.method === 'sign_event' && perm.kind !== undefined) {
    const kindLabel = kindLabels[perm.kind] || `kind ${perm.kind}`;
    return `Sign ${kindLabel}`;
  }

  return baseLabel;
}

/**
 * Truncate a pubkey for display.
 */
export function truncatePubkey(pubkey: string): string {
  if (pubkey.length <= 16) return pubkey;
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
}
