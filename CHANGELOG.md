# Changelog

## [1.1.1]

### Added
- Daemon now shows local network IP addresses on startup for easier mobile setup
- QR code displayed on startup when a single network address is detected (for quick Android app configuration)
- Container detection: when running in Docker, shows helpful message instead of container-internal IP
- Android app: QR code scanner for quick server URL configuration (scan the QR code from daemon startup)

### Fixed
- Fixed "Failed to resolve entry for package @signet/types" error when running `pnpm run dev` after fresh clone (types package now builds automatically on install)
- Android app: Fixed confusing placeholder text in server URL field (was emulator-specific `10.0.2.2`)

---

## [1.1.0]

### Added
- Android app: Dashboard stat widgets (Active Keys, Apps, Relays) are now tappable. Active Keys and Apps navigate to their respective pages, Relays opens a status sheet showing connection details
- Web UI: Dashboard stat cards are now clickable. Active Keys, Apps, and Activity navigate to their pages; Relays opens a modal showing connection details for each relay
- Active Keys widget now shows "active/total" format" to indicate how many keys are unlocked
- Added single `VERSION` file at repo root, used by all apps (run `pnpm sync-version` after updating)

### Improved
- Android app: Setup screen now explains what the app does and links to documentation
- Android app: Setup screen tests server connection before proceeding, with helpful error messages

### Fixed
- Android app: Revoking apps now works correctly (fixed empty JSON body causing "Bad request" error)
- Android app: All screens now update in real-time via SSE (Dashboard stats, Keys, Apps, Activity pages)
- Web UI: All screens now update in real-time via SSE (Dashboard stats, Keys, Apps, Activity pages)

---

## [1.0.0]

### Added
- Native Android app for mobile key management
- App names displayed throughout UI instead of truncated npubs
- Auto-approved requests now logged and visible in Activity feed
- All NIP-46 events (sign_event, nip04/nip44 encrypt/decrypt) now appear in Activity
- Denied requests tracked and visible in Activity feed with dedicated Denied tab
- Real-time updates via Server-Sent Events
- Batch approval for multiple pending requests
- Search and filtering for requests and apps
- Command palette (Cmd+K / Ctrl+K)
- Relay health monitoring with auto-reconnect
- Help page with documentation and keyboard shortcuts
- NIP-04 encryption support for legacy clients
- Added DEPLOYMENT.md to document how to run Signet behind Tailscale
- Added dashboard and help page screenshots
- SSE events for app revoke/update and key rename/passphrase changes
- SSE connection reliability: heartbeat monitoring, page visibility handling, network status awareness, automatic state refresh on reconnection
- Default trust level setting for new app connections

### Changed
- CSRF protection now skipped for Bearer token authentication (API clients using `Authorization: Bearer` header no longer need CSRF tokens)
- Complete UI redesign with dark theme and sidebar navigation
- WCAG 2.1 AA accessibility compliance
- Connect flow now always requires manual approval with trust level selection
- Simplified trust level labels: "Always Ask", "Auto-approve Safe", "Auto-approve All"
- User-friendly method labels throughout UI (e.g., "Sign a note" instead of "sign_event")
- Activity page tabs reorganized: "All" (default), "Approved", "Denied", "Expired" (removed "Pending" since Home handles it)
- Switched Docker images from node:20-alpine to node:20-slim to avoid building better-sqlite3 from source on image rebuids.
- Updated all documentation to reflect current state of backend and frontend
- SSE keep-alive interval reduced from 30s to 15s for better proxy compatibility

### Removed
- OAuth account creation flow
- NDK dependency (replaced with nostr-tools)
- Auto-refresh settings (SSE handles all real-time updates)

### Fixed
- Relay subscriptions now recover after system sleep/wake
- Pending count excludes expired requests
- Various race conditions and error handling improvements
- All approved requests now logged to Activity (not just trust-level auto-approvals)
- Trust level changes now properly enforced: downgrading from "full" removes explicit permissions that would bypass trust level checks

### Security
- JWT authentication required for all sensitive endpoints
- Upgraded to AES-256-GCM encryption with PBKDF2 (600k iterations)
- CSRF protection, rate limiting, timing-safe comparisons

---

## [0.10.5]

Initial public release of Signet fork from nsecbunkerd.

### Added
- Modern React dashboard UI
- NIP-46 remote signing support
- Multi-key management
- Web-based request approval flow
- Docker Compose deployment
