# Manual QA & Accessibility Testing Checklist

Comprehensive manual testing guide for Helix Desktop phases A-J.

**Date**: 2026-02-06
**Status**: Ready for testing
**Test Environment**: All platforms (macOS, Windows, Linux)

---

## Quick Start

```bash
# Run all E2E tests
npx playwright test

# Run with UI
npx playwright test --ui

# Run specific test
npx playwright test --grep "Chat workflow"

# Run headed (show browser)
npx playwright test --headed

# Generate report
npx playwright show-report
```

---

## WCAG 2.1 AA Accessibility Checklist

### 1. Keyboard Navigation (WCAG 2.1.1)

- [ ] **Tab order is logical** - Tab through entire app, verify order makes sense
- [ ] **No keyboard traps** - Can Tab out of all elements
- [ ] **Focus indicators visible** - All interactive elements show focus clearly
- [ ] **Keyboard shortcuts documented** - Settings > Keyboard Shortcuts is accurate
- [ ] **All functions keyboard accessible** - No mouse-only features

#### Testing Steps

```
1. Start at login page
2. Tab through all fields
3. Can you reach every button?
4. Can you submit forms with Enter?
5. Can you cancel dialogs with Escape?
6. Tab order in modals - does it trap focus properly?
7. Does focus move back after closing dialog?
```

### 2. Color Contrast (WCAG 1.4.3)

Required ratio: **4.5:1** for normal text, **3:1** for large text

- [ ] **Text on background** - All text meets 4.5:1 contrast
- [ ] **Disabled text** - Is it still readable?
- [ ] **Error messages** - Red text on light background?
- [ ] **Focus indicators** - Contrast sufficient?
- [ ] **Links** - Are underlined or distinguished in color?
- [ ] **Dark mode contrast** - Test in both light & dark themes

#### Testing with Tools

```bash
# Browser DevTools
1. Right-click any text
2. Inspect > Computed > Color
3. Check contrast ratio in DevTools
```

### 3. Focus Management (WCAG 2.4.3)

- [ ] **Focus visible at all times** - Can see where focus is
- [ ] **Focus outline not removed** - No `outline: none` without replacement
- [ ] **Focus indicator sufficiently large** - At least 2px visible
- [ ] **Focus color distinct** - Not same as non-focused state
- [ ] **Focus indicator has sufficient contrast** - 3:1 against adjacent colors

### 4. Alternative Text (WCAG 1.1.1)

- [ ] **All images have alt text** - Icons, logos, diagrams
- [ ] **Decorative images marked** - `aria-hidden="true"`
- [ ] **Buttons have accessible names** - Icon buttons have aria-label
- [ ] **Form labels present** - Each input has associated label

### 5. Form Labels (WCAG 3.3.2)

- [ ] **All inputs have labels** - Associated via `htmlFor` or `aria-labelledby`
- [ ] **Required fields marked** - Visual indicator + accessible name
- [ ] **Error messages linked** - `aria-describedby` points to error
- [ ] **Placeholders not used as labels** - Placeholder disappears when typing

### 6. Language (WCAG 3.1.1)

- [ ] **Page language declared** - `<html lang="en">`
- [ ] **Text direction correct** - For any RTL content

### 7. Headings (WCAG 1.3.1)

- [ ] **Proper heading hierarchy** - No skipping levels (h1 → h3)
- [ ] **Only one h1 per page** - Main page heading
- [ ] **Headings are semantic** - Use `<h1>-<h6>`, not styled divs

### 8. Buttons & Links (WCAG 2.4.4, 2.4.9)

- [ ] **Button purpose clear** - Text or icon is understandable
- [ ] **Links distinguishable** - Not just color
- [ ] **Link text meaningful** - Not "click here"
- [ ] **Buttons are buttons** - Use `<button>`, not styled divs
- [ ] **Links are links** - Use `<a>`, not buttons

---

## Manual QA Testing Matrix

### Phase A: Foundation & Onboarding

#### Authentication Flow

- [ ] **Login page loads** with email/password fields
- [ ] **Validation works** - empty field shows error
- [ ] **Invalid credentials** - shows error message
- [ ] **Valid credentials** - logs in successfully
- [ ] **Forgot password** - link available and works
- [ ] **Remember me** - works if implemented
- [ ] **2FA** - works if implemented
- [ ] **Logout** - works, redirects to login
- [ ] **Timeout** - logs out after inactivity
- [ ] **Token refresh** - automatic without re-login

#### Onboarding Flow (if shown to new users)

- [ ] **Step 1 (Device Registration)** - Can register device
- [ ] **Step 2** - All steps complete without errors
- [ ] **Final step** - "Done" button works
- [ ] **Skip available** - Can skip and use app anyway
- [ ] **Progress indicator** - Shows progress accurately

### Phase B: Agent Command Center

- [ ] **Agent list loads** - Shows at least one default agent
- [ ] **Create agent** - Opens dialog, submits successfully
- [ ] **Agent appears in list** - After creation
- [ ] **Edit agent** - Can change name, workspace
- [ ] **Delete agent** - Requires confirmation
- [ ] **Agent deleted** - Removed from list
- [ ] **Set as default** - Works, shown with indicator
- [ ] **View agent details** - Shows all configuration
- [ ] **Workspace explorer** - Opens, shows files
- [ ] **Bootstrap files** - Can edit (AGENTS.md, SOUL.md, etc.)
- [ ] **Agent routing** - Visual binding editor works
- [ ] **Test routing** - "Which agent handles X?" works

### Phase C: Skills Marketplace

- [ ] **Skills list loads** - Shows installed skills
- [ ] **ClawHub browser** - Opens, shows skills
- [ ] **Search works** - Results filter by query
- [ ] **Filter by category** - Category selector works
- [ ] **Install skill** - One-click install works
- [ ] **Skill appears** - After install, in list
- [ ] **Uninstall skill** - Requires confirmation
- [ ] **Skill removed** - After uninstall
- [ ] **Skill details** - Can view description, requirements
- [ ] **Per-agent config** - Can enable/disable per agent
- [ ] **Environment vars** - Can set per agent

### Phase D: Tools & Security

- [ ] **Tools toggle** - Can enable/disable tool groups
- [ ] **Profiles** - Can select minimal/coding/full
- [ ] **Allow list** - Can add/remove patterns
- [ ] **Deny list** - Can add/remove patterns
- [ ] **Approvals dashboard** - Shows pending approvals
- [ ] **Approval notification** - Tray shows badge
- [ ] **Approve button** - Approves request
- [ ] **Deny button** - Denies request
- [ ] **"Always allow"** - Option works
- [ ] **Approval resolves** - Disappears from list
- [ ] **Sandbox toggle** - Can enable/disable
- [ ] **Sandbox settings** - Can configure mode, scope
- [ ] **Browser panel** - Shows browser status
- [ ] **Browser control** - Can start/stop

### Phase E: Channel Powerhouse

- [ ] **Channels grid** - Shows all 6 channel types
- [ ] **Channel status** - Shows connected/disconnected
- [ ] **Connect WhatsApp** - QR code displays, can scan
- [ ] **Connect Telegram** - Token input works, saves
- [ ] **Connect Discord** - Token input works, shows guilds
- [ ] **Channel detail** - Opens, shows settings
- [ ] **DM policy** - Can change pairing/allowlist/open
- [ ] **Group policy** - Can change allowlist/open
- [ ] **Allowlist editor** - Can add/remove entries
- [ ] **Media settings** - Can configure max size, types
- [ ] **Save settings** - Persists across restarts
- [ ] **Disconnect** - Channel shows disconnected after

### Phase F: Voice & Media Center

- [ ] **Talk mode button** - Exists and clickable
- [ ] **Start talk mode** - Opens overlay
- [ ] **Listening state** - Shows mic icon, pulsing
- [ ] **Speak message** - (Simulated) text input or actual audio
- [ ] **Thinking state** - Loading animation shows
- [ ] **Speaking state** - Waveform animates
- [ ] **Exit talk mode** - Button closes overlay
- [ ] **Voice settings** - Can select provider (ElevenLabs, OpenAI)
- [ ] **Voice speed** - Slider adjusts 0.5-2.0
- [ ] **Camera capture** - Opens, shows camera feed
- [ ] **Screen capture** - Opens, allows region selection
- [ ] **Capture button** - Saves to file or gallery
- [ ] **Media gallery** - Shows captured media

### Phase G: Session & Memory Intelligence

- [ ] **Session config** - Opens, shows options
- [ ] **Scope selector** - Can change per-sender/per-channel
- [ ] **Reset mode** - Can select daily/idle/manual
- [ ] **Reset time** - Slider adjusts hours
- [ ] **Idle timeout** - Slider adjusts minutes
- [ ] **Memory flush** - Toggle works
- [ ] **Session history** - Opens, shows message list
- [ ] **Search memories** - Can enter query
- [ ] **Semantic search** - Returns relevant results
- [ ] **Memory detail** - Can view full memory content
- [ ] **Export session** - Can export to JSON/Markdown
- [ ] **Compaction** - Manual trigger works

### Phase H: Node & Device Network

- [ ] **Devices list** - Shows paired devices
- [ ] **Device status** - Shows online/offline
- [ ] **Pairing request** - Notification appears
- [ ] **Approve device** - Button works
- [ ] **Device approved** - Moves to paired list
- [ ] **Reject device** - Removes pairing request
- [ ] **Revoke device** - Can revoke access
- [ ] **Rotate token** - Creates new token
- [ ] **Nodes list** - Shows available nodes
- [ ] **Node capabilities** - Lists system, camera, etc.
- [ ] **Invoke command** - Can run command on node
- [ ] **Exec policy** - Can configure allowlist

### Phase I: Advanced Configuration

- [ ] **Model selector** - Can choose primary model
- [ ] **Failover chain** - Can drag to reorder
- [ ] **Thinking level** - Can select off/low/high
- [ ] **Auth profiles** - Can add/remove profiles
- [ ] **OAuth flow** - Opens auth dialog
- [ ] **API key entry** - Can paste key
- [ ] **Hooks list** - Shows available hooks
- [ ] **Enable/disable hook** - Toggle works
- [ ] **Gateway port** - Can configure
- [ ] **Logging level** - Can select debug/info/warn/error
- [ ] **Context pruning** - Can select mode

### Phase J: Polish & Distribution

- [ ] **Deep link helix://chat** - Opens chat
- [ ] **Deep link helix://settings/channels** - Opens channels settings
- [ ] **Tray menu** - Shows all items
- [ ] **Quick actions** - New Chat, Talk Mode work
- [ ] **Approvals badge** - Shows pending count
- [ ] **Agents submenu** - Lists agents with status
- [ ] **Channels submenu** - Lists channels with status
- [ ] **Keyboard shortcut Cmd+N** - New chat works
- [ ] **Keyboard shortcut Cmd+K** - Command palette works (if implemented)
- [ ] **Keyboard shortcut Cmd+,** - Settings works
- [ ] **Auto-update check** - Runs periodically
- [ ] **Update notification** - Shows when available
- [ ] **Update install** - Can install update

---

## Visual/Design QA

### Dark Mode Testing

- [ ] **All colors adjusted** - No light text on light background
- [ ] **Sufficient contrast** - All text meets WCAG AA
- [ ] **Accent colors** - Still distinguishable in dark
- [ ] **Icons** - Still visible and clear
- [ ] **Consistency** - All sections use same colors

### Light Mode Testing

- [ ] **Sufficient contrast** - All text readable
- [ ] **No bright whites** - Easier on eyes
- [ ] **Subtle shadows** - Depth perception maintained

### Responsive Design

#### Desktop (1920x1080)

- [ ] **No horizontal scroll** - All content visible
- [ ] **Sidebar visible** - Navigation accessible
- [ ] **Content area spacious** - Room for content
- [ ] **Modals centered** - Properly positioned

#### Laptop (1366x768)

- [ ] **Sidebar toggleable** - Can collapse to save space
- [ ] **No overlapping elements** - All visible
- [ ] **Text readable** - No tiny fonts

#### Tablet (1024x1366)

- [ ] **Layout adapts** - Sidebar or hamburger menu
- [ ] **Touch targets** - Buttons large enough (48x48px)
- [ ] **Keyboard support** - Virtual keyboard doesn't hide content

#### Mobile (375x667)

- [ ] **Hamburger menu** - Navigation hidden in menu
- [ ] **Stacked layout** - Everything in single column
- [ ] **Touch targets** - All buttons 48x48px minimum
- [ ] **Input fields** - Not obscured by keyboard

---

## Performance QA

### Load Time Testing

- [ ] **App launch < 5s** - From launch to usable state
- [ ] **Chat page < 2s** - After navigation
- [ ] **Settings < 1s** - Each settings section
- [ ] **Agent load < 1s** - After selecting agent

### Memory Testing

- [ ] **Initial memory < 200MB** - After launch
- [ ] **Memory stable** - No increase over 1 hour
- [ ] **No memory leaks** - After 100 messages sent
- [ ] **Task manager stable** - No runaway processes

### CPU Testing

- [ ] **Idle CPU < 5%** - When not active
- [ ] **Chat active < 20%** - While typing/sending
- [ ] **Smooth scrolling** - 60 FPS maintained
- [ ] **No UI freezes** - Animations smooth

---

## Cross-Platform Testing

### macOS

- [ ] **App launches** - From Applications folder
- [ ] **Keyboard shortcuts** - Cmd+ works (not Ctrl+)
- [ ] **Native menu bar** - File, Edit, Window, Help
- [ ] **Dock integration** - Icon appears, context menu works
- [ ] **System tray** - Works as menu bar icon
- [ ] **File dialogs** - Native macOS style
- [ ] **Notification Center** - Notifications appear
- [ ] **Spotlight** - App searchable (if integrated)

### Windows

- [ ] **App launches** - From Start menu
- [ ] **Keyboard shortcuts** - Ctrl+ works
- [ ] **Taskbar** - Icon appears, preview works
- [ ] **System tray** - Works as notification area
- [ ] **File dialogs** - Windows native style
- [ ] **Action Center** - Notifications appear
- [ ] **Windows dark mode** - App respects system setting
- [ ] **Windows high contrast** - Still readable (if supported)

### Linux

- [ ] **App launches** - From app menu or terminal
- [ ] **Keyboard shortcuts** - Ctrl+ works
- [ ] **Taskbar** - Integration with DE (GNOME/KDE/etc)
- [ ] **System tray** - Works with tray application
- [ ] **File dialogs** - Native to desktop environment
- [ ] **Dark mode** - Respects system GTK theme

---

## Error Handling QA

- [ ] **Network error** - Graceful error message, retry button
- [ ] **Gateway error** - Shows "gateway unreachable", auto-reconnect
- [ ] **API error** - Shows specific error, actionable feedback
- [ ] **Invalid input** - Form validation error shown
- [ ] **Timeout** - Operation shows "timed out", retry option
- [ ] **Missing permissions** - Shows "permission denied"
- [ ] **Offline mode** - App stays responsive, shows offline indicator
- [ ] **Recovery** - After fixing issue, operation succeeds

---

## Security QA

- [ ] **No console errors** - Open DevTools, check console
- [ ] **No exposed API keys** - Search DOM for sk-, api\_, secret
- [ ] **No hardcoded credentials** - Check localStorage, sessionStorage
- [ ] **HTTPS enforced** - All external requests use HTTPS
- [ ] **CSP headers** - Content Security Policy present
- [ ] **XSS prevention** - Try `<script>alert('xss')</script>` in inputs
- [ ] **CSRF tokens** - Present in forms
- [ ] **Rate limiting** - Multiple requests rejected appropriately
- [ ] **Session timeout** - Logs out after inactivity
- [ ] **Token rotation** - New token after each request (if applicable)

---

## Regression Testing Checklist

After each update/build:

- [ ] **Chat works** - Can send/receive messages
- [ ] **Settings save** - Changes persist
- [ ] **Logout/login** - Auth flow still works
- [ ] **Agent switching** - Can switch between agents
- [ ] **Channels connected** - Status shows correctly
- [ ] **Tray menu** - Shows correct information
- [ ] **No console errors** - DevTools clean
- [ ] **No visual glitches** - Everything looks correct

---

## Known Limitations & Workarounds

(To be updated during testing)

| Issue | Workaround | Status |
| ----- | ---------- | ------ |
|       |            |        |

---

## Test Results Summary

**Date**: \***\*\_\_\_\*\***
**Tester**: \***\*\_\_\_\*\***
**Environment**: macOS / Windows / Linux
**Browser/Platform**: \***\*\_\_\_\*\***

### Results

- **Total Tests**: \_\_\_
- **Passed**: \_\_\_
- **Failed**: \_\_\_
- **Blocked**: \_\_\_
- **Pass Rate**: \_\_\_%

### Critical Issues Found

(List any P0 bugs here)

### High Priority Issues

(List P1 bugs here)

### Medium Priority Issues

(List P2 bugs here)

### Recommendations

(Any improvements noticed)

---

**Last Updated**: 2026-02-06
