---
description: Visual Review Command - Frontend verification with Playwright for Lit components
argument-hint: [component] [--url=path] [--full-page] [--all]
---

# /visual-review Command

Visual QA for OpenClaw's Lit-based control UI using Playwright browser automation.

## Usage

```bash
/visual-review                    # Review current page
/visual-review chat               # Review chat component
/visual-review --url=/config      # Review specific URL
/visual-review --full-page        # Full page screenshots
/visual-review --all              # Review all major pages
```

## What It Does

Uses Playwright MCP to capture and analyze the OpenClaw Lit-based web UI.

### Screenshot Breakpoints

| Name | Width | Height | Device |
|------|-------|--------|--------|
| Mobile | 375px | 812px | iPhone SE |
| Tablet | 768px | 1024px | iPad |
| Desktop | 1440px | 900px | Desktop |

### Pages to Review

Based on OpenClaw's UI structure:

| Page | URL | Components |
|------|-----|------------|
| Overview | `/` | Status dashboard |
| Chat | `/chat` | Chat interface |
| Config | `/config` | Configuration forms |
| Sessions | `/sessions` | Session management |
| Logs | `/logs` | Log viewer |
| Skills | `/skills` | Skill management |

### Accessibility Checklist

- [ ] Color contrast >= 4.5:1
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] ARIA labels present
- [ ] Form labels associated
- [ ] Headings in correct order

### Component State Testing

For each Lit component, verify:

| State | Description |
|-------|-------------|
| Default | Initial render |
| Loading | Skeleton/spinner |
| Error | Error message display |
| Empty | No data state |
| Success | Completed action |
| Disabled | Inactive state |
| Hover | Mouse over |
| Focus | Keyboard focus |

## Instructions

Delegate to the **frontend-reviewer agent** to perform the review.

### Before Starting

Ensure OpenClaw UI is running:

```bash
# Start OpenClaw control UI (if not running)
cd openclaw-helix && npm run dev
```

### Use Playwright MCP Tools

```text
# Navigate to page
mcp__plugin_playwright_playwright__browser_navigate
url: "http://localhost:3000/chat"

# Take accessibility snapshot
mcp__plugin_playwright_playwright__browser_snapshot

# Take screenshot
mcp__plugin_playwright_playwright__browser_take_screenshot
type: "png"

# Resize for breakpoints
mcp__plugin_playwright_playwright__browser_resize
width: 375
height: 812

# Check console for errors
mcp__plugin_playwright_playwright__browser_console_messages
```

## Output Format

```markdown
## Visual Review Report

### Configuration
- Base URL: http://localhost:3000
- Pages reviewed: X
- Breakpoints: Mobile, Tablet, Desktop

### Page Results

#### Chat Page

| Breakpoint | Status | Issues |
|------------|--------|--------|
| Desktop (1440px) | OK | None |
| Tablet (768px) | OK | None |
| Mobile (375px) | WARN | Overflow on message list |

**Screenshots:**
- [chat-desktop.png]
- [chat-tablet.png]
- [chat-mobile.png]

**Accessibility:**
- [ ] Color contrast: PASS
- [ ] Keyboard nav: PASS
- [ ] Focus states: PASS
- [ ] ARIA labels: WARN - Missing on send button

**Component States:**
- [x] Default render
- [x] Loading state (skeleton)
- [x] Empty state (no messages)
- [ ] Error state (not tested)

### Lit Component Analysis

| Component | File | Status | Notes |
|-----------|------|--------|-------|
| chat-view | ui/src/ui/chat.ts | OK | |
| config-form | ui/src/ui/config.ts | WARN | Long forms overflow |
| session-list | ui/src/ui/sessions.ts | OK | |

### CSS Issues

1. **Overflow on mobile** - chat-view.ts:45
   - Message list doesn't scroll properly on mobile
   - Suggested fix: Add `overflow-y: auto`

2. **Color contrast** - config-form.ts:89
   - Label text too light on dark mode
   - Suggested fix: Increase contrast ratio

### Console Errors

None found.

### Recommendations

1. Add ARIA labels to action buttons
2. Fix mobile overflow in chat view
3. Improve dark mode contrast
4. Add loading skeletons to all async components

### Overall: PASS | WARN | FAIL
```

## Lit Component Patterns

When reviewing, check for proper Lit patterns:

### Good Patterns

```typescript
// Reactive properties with decorators
@property({ type: String }) message = '';

// Scoped styles
static styles = css`
  :host { display: block; }
`;

// Template with proper binding
render() {
  return html`<div>${this.message}</div>`;
}
```

### Issues to Flag

- Missing `:host` styles
- Unscoped global styles
- Missing `@property` decorators
- Direct DOM manipulation
- Missing loading states

## When to Use

- After modifying UI components
- Before releasing UI changes
- During accessibility audits
- When debugging visual issues

## Related Commands

- `/audit` - Full codebase audit
- `/quality` - Code quality checks
- `/pipeline` - Full development pipeline
