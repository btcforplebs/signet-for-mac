import { describe, it, expect } from 'vitest';
import {
    parseNostrconnectUri,
    isValidPubkey,
    formatPermissionForDisplay,
    type NostrconnectPermission,
} from '../nostrconnect.js';

// Valid 64-char hex pubkey for testing
const VALID_PUBKEY = '83f3b2ae6f02e870f12a8b71e7e87f6f5b2e4a9c8d1b3c4a5d6e7f8091a2b3c4';
const VALID_RELAY = 'wss://relay.example.com';
const VALID_SECRET = 'abc123secret';

describe('parseNostrconnectUri', () => {
    describe('valid URIs', () => {
        it('should parse a minimal valid URI', () => {
            const uri = `nostrconnect://${VALID_PUBKEY}?relay=${VALID_RELAY}&secret=${VALID_SECRET}`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.clientPubkey).toBe(VALID_PUBKEY);
                expect(result.data.relays).toEqual([VALID_RELAY]);
                expect(result.data.secret).toBe(VALID_SECRET);
                expect(result.data.permissions).toEqual([]);
                expect(result.data.name).toBeUndefined();
                expect(result.data.url).toBeUndefined();
            }
        });

        it('should parse URI with multiple relays', () => {
            const relay1 = 'wss://relay1.example.com';
            const relay2 = 'wss://relay2.example.com';
            const uri = `nostrconnect://${VALID_PUBKEY}?relay=${relay1}&relay=${relay2}&secret=${VALID_SECRET}`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.relays).toEqual([relay1, relay2]);
            }
        });

        it('should parse URI with all optional parameters', () => {
            const uri = `nostrconnect://${VALID_PUBKEY}?relay=${VALID_RELAY}&secret=${VALID_SECRET}&name=MyApp&url=https://myapp.com&perms=sign_event:1,nip44_encrypt`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.name).toBe('MyApp');
                expect(result.data.url).toBe('https://myapp.com');
                expect(result.data.permissions).toEqual([
                    { method: 'sign_event', kind: 1 },
                    { method: 'nip44_encrypt' },
                ]);
            }
        });

        it('should handle URL-encoded relay URLs', () => {
            const encodedRelay = encodeURIComponent('wss://relay.example.com/path');
            const uri = `nostrconnect://${VALID_PUBKEY}?relay=${encodedRelay}&secret=${VALID_SECRET}`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.relays).toEqual(['wss://relay.example.com/path']);
            }
        });

        it('should normalize relay URLs without scheme', () => {
            const uri = `nostrconnect://${VALID_PUBKEY}?relay=relay.example.com&secret=${VALID_SECRET}`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.relays).toEqual(['wss://relay.example.com']);
            }
        });

        it('should lowercase the pubkey', () => {
            const upperPubkey = VALID_PUBKEY.toUpperCase();
            const uri = `nostrconnect://${upperPubkey}?relay=${VALID_RELAY}&secret=${VALID_SECRET}`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.clientPubkey).toBe(VALID_PUBKEY);
            }
        });

        it('should trim whitespace from URI', () => {
            const uri = `  nostrconnect://${VALID_PUBKEY}?relay=${VALID_RELAY}&secret=${VALID_SECRET}  `;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(true);
        });
    });

    describe('invalid URIs', () => {
        it('should reject non-nostrconnect scheme', () => {
            const uri = `bunker://${VALID_PUBKEY}?relay=${VALID_RELAY}&secret=${VALID_SECRET}`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.type).toBe('invalid_scheme');
            }
        });

        it('should reject missing pubkey', () => {
            const uri = `nostrconnect://?relay=${VALID_RELAY}&secret=${VALID_SECRET}`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.type).toBe('missing_pubkey');
            }
        });

        it('should reject invalid pubkey (wrong length)', () => {
            const uri = `nostrconnect://abc123?relay=${VALID_RELAY}&secret=${VALID_SECRET}`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.type).toBe('invalid_pubkey');
            }
        });

        it('should reject invalid pubkey (non-hex characters)', () => {
            const invalidPubkey = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';
            const uri = `nostrconnect://${invalidPubkey}?relay=${VALID_RELAY}&secret=${VALID_SECRET}`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.type).toBe('invalid_pubkey');
            }
        });

        it('should reject missing relay', () => {
            const uri = `nostrconnect://${VALID_PUBKEY}?secret=${VALID_SECRET}`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.type).toBe('missing_relay');
            }
        });

        it('should reject missing secret', () => {
            const uri = `nostrconnect://${VALID_PUBKEY}?relay=${VALID_RELAY}`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.type).toBe('missing_secret');
            }
        });

        it('should reject empty secret', () => {
            const uri = `nostrconnect://${VALID_PUBKEY}?relay=${VALID_RELAY}&secret=`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(false);
            if (!result.success) {
                expect(result.error.type).toBe('missing_secret');
            }
        });
    });

    describe('permissions parsing', () => {
        it('should parse single permission without kind', () => {
            const uri = `nostrconnect://${VALID_PUBKEY}?relay=${VALID_RELAY}&secret=${VALID_SECRET}&perms=nip44_encrypt`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.permissions).toEqual([
                    { method: 'nip44_encrypt' },
                ]);
            }
        });

        it('should parse single permission with kind', () => {
            const uri = `nostrconnect://${VALID_PUBKEY}?relay=${VALID_RELAY}&secret=${VALID_SECRET}&perms=sign_event:1`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.permissions).toEqual([
                    { method: 'sign_event', kind: 1 },
                ]);
            }
        });

        it('should parse multiple permissions', () => {
            const uri = `nostrconnect://${VALID_PUBKEY}?relay=${VALID_RELAY}&secret=${VALID_SECRET}&perms=sign_event:1,sign_event:7,nip44_encrypt`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.permissions).toEqual([
                    { method: 'sign_event', kind: 1 },
                    { method: 'sign_event', kind: 7 },
                    { method: 'nip44_encrypt' },
                ]);
            }
        });

        it('should handle empty perms parameter', () => {
            const uri = `nostrconnect://${VALID_PUBKEY}?relay=${VALID_RELAY}&secret=${VALID_SECRET}&perms=`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.permissions).toEqual([]);
            }
        });

        it('should handle invalid kind gracefully', () => {
            const uri = `nostrconnect://${VALID_PUBKEY}?relay=${VALID_RELAY}&secret=${VALID_SECRET}&perms=sign_event:notanumber`;
            const result = parseNostrconnectUri(uri);

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.permissions).toEqual([
                    { method: 'sign_event' },
                ]);
            }
        });
    });
});

describe('isValidPubkey', () => {
    it('should return true for valid 64-char hex pubkey', () => {
        expect(isValidPubkey(VALID_PUBKEY)).toBe(true);
    });

    it('should return false for too short pubkey', () => {
        expect(isValidPubkey('abc123')).toBe(false);
    });

    it('should return false for too long pubkey', () => {
        expect(isValidPubkey(VALID_PUBKEY + 'extra')).toBe(false);
    });

    it('should return false for non-hex characters', () => {
        const invalidPubkey = 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';
        expect(isValidPubkey(invalidPubkey)).toBe(false);
    });

    it('should return false for empty string', () => {
        expect(isValidPubkey('')).toBe(false);
    });
});

describe('formatPermissionForDisplay', () => {
    it('should format sign_event with known kind', () => {
        const perm: NostrconnectPermission = { method: 'sign_event', kind: 1 };
        expect(formatPermissionForDisplay(perm)).toBe('Sign notes');
    });

    it('should format sign_event with unknown kind', () => {
        const perm: NostrconnectPermission = { method: 'sign_event', kind: 99999 };
        expect(formatPermissionForDisplay(perm)).toBe('Sign kind 99999');
    });

    it('should format sign_event without kind', () => {
        const perm: NostrconnectPermission = { method: 'sign_event' };
        expect(formatPermissionForDisplay(perm)).toBe('Sign events');
    });

    it('should format known methods', () => {
        expect(formatPermissionForDisplay({ method: 'nip44_encrypt' })).toBe('NIP-44 encryption');
        expect(formatPermissionForDisplay({ method: 'nip44_decrypt' })).toBe('NIP-44 decryption');
        expect(formatPermissionForDisplay({ method: 'nip04_encrypt' })).toBe('NIP-04 encryption');
        expect(formatPermissionForDisplay({ method: 'get_public_key' })).toBe('Get public key');
    });

    it('should return method name for unknown methods', () => {
        const perm: NostrconnectPermission = { method: 'unknown_method' };
        expect(formatPermissionForDisplay(perm)).toBe('unknown_method');
    });
});
