# Future Improvements: Helix Desktop Application

This document tracks enhancement opportunities and polish items discovered during development but deferred for future iterations.

---

## Phase K: Polish & Testing Infrastructure - Future Enhancements

Completed items and suggested improvements for future work:

### Task K1: Environment Variables Editor

#### Completed ✅

- Gateway config integration (load/save/delete)
- Graceful offline fallback
- Read-only enforcement for system/inherited variables
- Route accessible at `/settings/environment`

#### Future Enhancements

- **OS-Level Integration**
  - Add Tauri backend commands to read actual system environment variables
  - Display running process environment separately from config
  - Real-time sync with shell environment changes

- **Import/Export Functionality**
  - Import from `.env` files (parse and validate)
  - Import from JSON files
  - Export all user variables to `.env` format
  - Export to JSON with metadata
  - Bulk operations (import/export multiple at once)

- **Templates & Presets**
  - Pre-built templates for common services (Stripe, OpenAI, Anthropic, etc.)
  - Copy-paste friendly setup instructions per provider
  - Validation hints (e.g., "API key should start with sk-" for Stripe)
  - Suggested values for optional variables

- **Advanced Features**
  - Variable dependency detection (e.g., OPENAI_API_KEY requires OPENAI_ORG_ID)
  - Encryption for secrets at rest in config file
  - Variable usage analytics (which plugins/agents use each variable)
  - Audit log of variable changes (with diffs)

---

### Task K2a: Pending Approvals in System Tray

#### Completed ✅

- Live tracking of pending approvals via events
- Initial count fetch from gateway snapshot
- Tray menu count updates
- Event subscription/unsubscription

#### Future Enhancements

- **User Notifications**
  - Native OS notifications on new approval request
  - Configurable notification sound
  - Desktop alerts with dismiss/approve/deny actions
  - Browser notifications if Helix web UI is open

- **Quick Actions from Tray**
  - Right-click approval item → approve/deny directly
  - Show approval details (command, actor, timestamp) in tray
  - "Open Approvals Panel" quick link
  - Approval filtering (hide old ones, show only from specific agents)

- **Advanced Features**
  - Approval timeout warnings (e.g., "Auto-denying in 5 mins")
  - Bulk approve/deny for related commands
  - "Always Allow This Command" quick option
  - Approval statistics (approval rate, average response time)

---

### Task K2b: Channel Setup Modal

#### Completed ✅

- Shared modal component supporting 7 auth types
- Channel-specific setup flows
- Type-safe configuration handling
- Integration into Settings

#### Future Enhancements

- **Refactoring**
  - Migrate ChannelsStep.tsx to use shared ChannelSetupModal
  - Eliminate duplicate channel setup code
  - Consolidate channel credentials management

- **Setup UX Improvements**
  - Multi-step setup wizards for complex channels (Discord, Telegram)
  - Inline validation feedback (real-time token validation)
  - Channel connection testing before saving
  - Credential masking with copy-to-clipboard
  - Setup progress indicators

- **Detailed Instructions**
  - Per-channel setup documentation (embedded or linked)
  - Screenshots/GIFs for complex flows (QR code scanning, OAuth)
  - Troubleshooting section per channel
  - Video tutorials for popular channels
  - Common error messages and solutions

- **Credential Management**
  - Pre-save validation (token format, URL reachability)
  - Health checks after saving (connection test)
  - Credential rotation reminders (e.g., "Token expires in 30 days")
  - Multiple credentials per channel (e.g., personal + business WhatsApp)
  - Credential history (when was it last used, what performed the operation)

---

### Task K3: Gateway Integration Testing Infrastructure

#### Completed ✅

- GatewayClient event emission methods (on/off)
- EventEmitter-style event handling
- Test-ready client methods (disconnect, role getter)

#### Future Enhancements

- **Expanded Test Coverage**
  - useGateway hook integration tests (connection, reconnection, message accumulation)
  - useGatewaySync hook tests (tray state synchronization)
  - End-to-end integration tests (desktop → gateway → response → UI)
  - Chat message streaming tests (thinking → content → complete phases)

- **Edge Case Testing**
  - Network failure scenarios (connection drops, timeouts)
  - Malformed message handling
  - Large message chunking
  - Concurrent requests
  - Message queue overflow

- **Rust Backend Tests**
  - Gateway monitor status transitions
  - Health check polling
  - Process lifecycle (start/stop/restart)
  - Error logging to Discord
  - Port conflict detection

- **Performance Testing**
  - Message throughput benchmarks
  - Memory usage during long sessions
  - Connection establishment latency
  - Event handler execution time

- **Mock Server Enhancements**
  - Support for additional gateway methods (agents._, skills._, etc.)
  - Configurable delay simulation (network latency)
  - Message corruption injection (test error handling)
  - State tracking (verify command sequences)
  - Request/response validation

---

## General Desktop App Improvements

Beyond Phase K, consider these opportunities:

### UI/UX Polish

- Dark mode refinements (contrast, accessibility)
- Loading state animations
- Skeleton screens during data fetch
- Toast notifications for operations
- Undo/redo for destructive operations
- Keyboard navigation for all panels

### Performance

- Virtual scrolling for large lists (channels, agents, skills)
- Lazy loading for heavy components
- Debounced search inputs
- Connection pooling for gateway
- Message batching in gateway protocol

### Accessibility

- WCAG 2.1 AA compliance audit
- Screen reader testing
- Keyboard-only navigation
- High contrast mode
- Font size controls

### Developer Experience

- Storybook for component library
- Component documentation
- Development console for debugging
- Network inspection tools
- Redux DevTools for state inspection

### Documentation

- Component API documentation
- Architecture decision records (ADRs)
- Setup guide for new developers
- Common troubleshooting guide
- API endpoint reference

---

## Notes

- **Priority**: Future enhancements are ordered by user impact (high-impact items first)
- **Blockers**: Some enhancements depend on gateway features not yet implemented
- **Scope**: Keep enhancements focused; avoid scope creep
- **Testing**: Every enhancement should include unit tests and E2E tests
- **Review**: Before implementing, get user feedback on prioritization

---

**Last Updated**: 2026-02-06
**Status**: Ready for future work
