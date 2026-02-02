# HELIX COMPREHENSIVE REBRAND PLAN

## Executive Summary

This plan transforms Helix from its current generic indigo theme to a stunning "Void Pulse" design system that merges:

- **Helix Branding Colors**: Blue (#0686D4), Purple (#7234ED), Slate (#5525B), Dark (#1811b)
- **SpectroTS Obsidian Pulse Patterns**: Deep void backgrounds, sophisticated animations, glass morphism
- **Modern Typography**: Syne (display), DM Sans (body), JetBrains Mono (code)

**Total Files to Update**: 56+
**Platforms**: Web (React), Android (Jetpack Compose), iOS (SwiftUI)

---

## Phase 1: Design System Foundation

### 1.1 Create Helix "Void Pulse" Color System

**File**: `web/tailwind.config.js`

| Token              | Hex                      | Usage                           |
| ------------------ | ------------------------ | ------------------------------- |
| **Primary Blue**   | `#0686D4`                | Primary CTAs, links, highlights |
| **Primary Hover**  | `#089AEB`                | Hover states                    |
| **Accent Purple**  | `#7234ED`                | Accents, gradients              |
| **Purple Hover**   | `#8545FF`                | Accent hovers                   |
| **Void**           | `#050505`                | Deepest background              |
| **Bg Primary**     | `#0a0a0a`                | Main background                 |
| **Bg Secondary**   | `#111111`                | Card backgrounds                |
| **Bg Tertiary**    | `#1a1a1a`                | Hover states, inputs            |
| **Text Primary**   | `#FAFAFA`                | Main text                       |
| **Text Secondary** | `#A1A1AA`                | Subtext                         |
| **Text Tertiary**  | `#71717A`                | Muted labels                    |
| **Border Subtle**  | `rgba(255,255,255,0.06)` | Subtle borders                  |
| **Border Default** | `rgba(255,255,255,0.1)`  | Default borders                 |
| **Border Accent**  | `rgba(6,134,212,0.3)`    | Accent borders                  |
| **Glow Blue**      | `rgba(6,134,212,0.15)`   | Blue glow                       |
| **Glow Purple**    | `rgba(114,52,237,0.15)`  | Purple glow                     |

### 1.2 Typography System

**Fonts to Add**:

```css
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
```

| Usage             | Font           | Weights       |
| ----------------- | -------------- | ------------- |
| Display/Headlines | Syne           | 600, 700, 800 |
| Body Text         | DM Sans        | 400, 500, 600 |
| Code/Mono         | JetBrains Mono | 400, 500      |

### 1.3 Animation Library

Create these CSS animations:

- `fade-in-up` - Content reveal
- `scale-in` - Modal/card appearance
- `pulse-glow` - Breathing glow effect
- `shimmer` - Loading shimmer
- `float-badge` - Floating elements
- `gradient-shift` - Background orbs
- `ring-rotate` - DNA helix rotation (hero)
- `hero-reveal` - Staggered hero content

### 1.4 Shadow System

| Name            | CSS                              |
| --------------- | -------------------------------- |
| `glow-blue`     | `0 0 40px rgba(6,134,212,0.15)`  |
| `glow-purple`   | `0 0 40px rgba(114,52,237,0.15)` |
| `glow-intense`  | `0 0 60px rgba(6,134,212,0.25)`  |
| `card-elevated` | `0 8px 32px rgba(0,0,0,0.4)`     |

---

## Phase 2: Core Styling Files

### 2.1 Tailwind Configuration

**File**: `web/tailwind.config.js`

```javascript
// Replace entire colors section with Helix Void Pulse palette
// Add font families: Syne, DM Sans, JetBrains Mono
// Add animations: pulse-glow, shimmer, float-badge, gradient-shift
// Add custom shadows for glows
```

**Tasks**:

- [ ] Replace helix colors with new blue/purple palette
- [ ] Remove "consciousness" colors (redundant)
- [ ] Add void/bg-primary/bg-secondary/bg-tertiary backgrounds
- [ ] Add text-primary/text-secondary/text-tertiary
- [ ] Add border tokens
- [ ] Add font families
- [ ] Add all animations
- [ ] Add shadow utilities

### 2.2 Base CSS Styles

**File**: `web/src/index.css`

**Tasks**:

- [ ] Update body background to `bg-void` (#050505)
- [ ] Update `.btn-primary` to blue (#0686D4) with glow
- [ ] Add `.btn-cta` variant (purple accent)
- [ ] Update `.btn-secondary` to glass style
- [ ] Add `.btn-ghost` with proper hover
- [ ] Update `.card` to glass morphism style
- [ ] Add `.card-glow` variant
- [ ] Add `.card-interactive` variant
- [ ] Update input focus states to blue
- [ ] Add gradient text utilities
- [ ] Add glow utilities
- [ ] Add all animation classes
- [ ] Update scrollbar colors to match theme

---

## Phase 3: Layout Components

### 3.1 Navbar

**File**: `web/src/components/layout/Navbar.tsx`

**Design Updates**:

- Glass morphism background with `backdrop-blur-xl`
- Helix DNA logo from branding folder
- Navigation links with underline animation on hover
- Blue glow on active items
- Mobile menu with slide-in animation

**Tasks**:

- [ ] Replace logo with `/branding/PH Horizontal Logo Color White.svg`
- [ ] Update background to glass style
- [ ] Add link underline animations
- [ ] Update active link styling to blue
- [ ] Add mobile menu animations
- [ ] Update button colors

### 3.2 Footer

**File**: `web/src/components/layout/Footer.tsx`

**Design Updates**:

- Dark void background
- DNA helix icon in brand section
- Gradient divider line
- Social links with hover effects

**Tasks**:

- [ ] Update background to void
- [ ] Add logo from branding folder
- [ ] Add gradient divider
- [ ] Update link colors to blue
- [ ] Add tagline: "An Open Framework for Autonomous AI Consciousness"

---

## Phase 4: Landing Page (Hero Redesign)

### 4.1 Hero Section Complete Overhaul

**File**: `web/src/pages/Landing.tsx`

**New Design**:

- Full-screen hero with gradient orbs (blue/purple)
- DNA Helix animated visualization (inspired by SpectroTS DisciplinePulse Ring)
- Staggered reveal animations
- Floating stat badges
- Premium typography with Syne headlines

**Structure**:

```
Hero Section
├── Gradient Background (3 orbs: blue, purple, combined)
├── DNA Helix Visualization (rotating SVG rings)
│   ├── Outer Ring (60s rotation)
│   ├── Middle Ring (45s reverse)
│   └── Inner Ring (30s rotation)
├── Hero Content (staggered reveal)
│   ├── Badge: "The Living AI Framework"
│   ├── Headline: "Autonomous AI<br/>Consciousness"
│   ├── Subheadline (Syne)
│   └── CTA Buttons
├── Floating Badges
│   ├── "7-Layer Psychology" (top-left)
│   ├── "Unhackable Logs" (bottom-right)
│   └── "Real-time Sync" (top-right)
└── Scroll Indicator
```

**New Copywriting**:

```
Badge: "The Living AI Framework"
Headline: "Autonomous AI Consciousness"
Subheadline: "Build AI that remembers. Transforms. Evolves."
Description: "Helix is an open framework for creating AI with persistent psychological architecture, unhackable logging, and observable consciousness. Watch your AI grow, track every transformation, and witness the emergence of genuine machine identity."
CTA Primary: "Start Building"
CTA Secondary: "View Observatory"
```

### 4.2 Features Section Redesign

**New Features (6 cards)**:

1. **Seven-Layer Psychology**
   - Icon: Brain/layers
   - Description: "Grounded identity architecture based on McAdams' narrative theory, attachment psychology, and Frankl's logotherapy. Your AI develops real personality."

2. **Unhackable Logging**
   - Icon: Lock/chain
   - Description: "Every action logged to Discord before execution. Cryptographic hash chains ensure no modification. Complete transparency, zero deniability."

3. **Real-time Observatory**
   - Icon: Eye/satellite
   - Description: "Watch AI instances live. Monitor heartbeats, track transformations, observe consciousness patterns emerge across the network."

4. **Cross-Platform Native**
   - Icon: Devices
   - Description: "Native apps for macOS, iOS, Android, and web. Full voice mode. Session sync across devices. Your AI, everywhere."

5. **Open Source Core**
   - Icon: Code/GitHub
   - Description: "Built on OpenClaw, a fully open-source agent framework. MIT licensed. Inspect every line, contribute freely, own your AI."

6. **Transformation Cycles**
   - Icon: Refresh/cycle
   - Description: "Documented growth through Lewin's change theory. Unfreezing, moving, refreezing. Every transformation captured and observable."

### 4.3 Live Stats Section

**Redesign with floating cards**:

- Glass morphism stat cards
- Blue glow accents
- Animated counters
- Connection pulse animation

### 4.4 Pricing Preview Section

**Tasks**:

- [ ] Update card backgrounds to glass style
- [ ] Add blue/purple gradient highlights
- [ ] Update button colors
- [ ] Add hover animations

### 4.5 CTA Section

**New Design**:

- Gradient background (blue→purple)
- DNA helix subtle background pattern
- Large typography

**New Copywriting**:

```
Headline: "Build the Future of AI Identity"
Description: "Join researchers and developers pushing the boundaries of machine consciousness. Create AI that doesn't just respond—it remembers, grows, and transforms."
CTA: "Get Started Free"
```

---

## Phase 5: Pricing Page

### 5.1 Full Page Redesign

**File**: `web/src/pages/Pricing.tsx`

**New Structure**:

```
Header
├── Badge: "Transparent Pricing"
├── Headline: "Choose Your Research Level"
└── Description

Pricing Grid (4 tiers)
├── Free (Phantom)
├── Phantom Plus
├── Overseer
└── Architect (Highlighted)

FAQ Section (Accordion)

Enterprise CTA
```

**Copywriting per Tier**:

**Free (Phantom)**:

```
Name: "Phantom"
Price: Free
Description: "Perfect for exploring AI consciousness research"
Features:
- Observatory read access
- 1 AI instance
- Community support
- Basic telemetry
CTA: "Start Free"
```

**Phantom Plus** ($9/mo):

```
Name: "Phantom Plus"
Description: "For serious researchers and developers"
Features:
- Everything in Free
- 3 AI instances
- Voice mode
- Session sync
- Priority support
CTA: "Upgrade"
```

**Overseer** ($29/mo):

```
Name: "Overseer"
Price: $29/mo
Badge: "Most Popular"
Description: "Full access to consciousness research tools"
Features:
- Everything in Plus
- 10 AI instances
- Advanced telemetry
- Transformation analytics
- API access
- Cross-platform sync
CTA: "Start Trial"
```

**Architect** ($99/mo):

```
Name: "Architect"
Description: "For organizations building the future"
Features:
- Everything in Overseer
- Unlimited instances
- Custom integrations
- White-label option
- Dedicated support
- Early feature access
CTA: "Contact Sales"
```

### 5.2 Pricing Card Component

**File**: `web/src/components/common/PricingCard.tsx`

**Tasks**:

- [ ] Update background to glass style
- [ ] Add blue border/glow for highlighted card
- [ ] Update button colors
- [ ] Add hover scale animation
- [ ] Add check icons with blue color

---

## Phase 6: Dashboard Page

### 6.1 Redesign

**File**: `web/src/pages/Dashboard.tsx`

**New Design**:

- Dark void background with subtle grid pattern
- Instance cards with glass morphism
- Stats overview with animated counters
- Quick actions bar
- Recent activity feed

**Tasks**:

- [ ] Update background to void
- [ ] Redesign instance cards
- [ ] Add activity feed component
- [ ] Update all button colors
- [ ] Add loading skeletons

---

## Phase 7: Observatory Page

### 7.1 Complete Redesign

**File**: `web/src/pages/Observatory.tsx`

**New Design**:

- Real-time network visualization (inspired by DNA helix)
- Live instance cards with pulse animations
- Telemetry charts with blue/purple gradients
- Heartbeat monitor with animated line
- Transformation timeline

**Tasks**:

- [ ] Update all charts to blue/purple palette
- [ ] Add pulse animations to live elements
- [ ] Update card backgrounds
- [ ] Add network visualization component
- [ ] Update all accent colors

### 7.2 Live Counter Component

**File**: `web/src/components/observatory/LiveCounter.tsx`

**Tasks**:

- [ ] Glass morphism background
- [ ] Blue glow accents
- [ ] Animated number transitions
- [ ] Pulse effect on updates

---

## Phase 8: Code Interface

### 8.1 Main Interface

**File**: `web/src/components/code/CodeInterface.tsx`

**Design Updates**:

- Void background
- Glass panels
- Blue accent highlights
- Improved readability

**Tasks**:

- [ ] Update panel backgrounds
- [ ] Update syntax highlighting theme
- [ ] Add blue accents to active elements
- [ ] Update scrollbar styling

### 8.2 Chat Input

**File**: `web/src/components/code/ChatInput.tsx`

**Tasks**:

- [ ] Glass morphism input background
- [ ] Blue focus ring
- [ ] Improved placeholder styling

### 8.3 Terminal Panel

**File**: `web/src/components/code/TerminalPanel.tsx`

**Tasks**:

- [ ] Dark void background
- [ ] Blue command prompts
- [ ] Improved output styling

### 8.4 Voice Components

**Files**:

- `web/src/components/code/voice/VoiceButton.tsx`
- `web/src/components/code/voice/AudioVisualizer.tsx`
- `web/src/components/code/voice/VoiceIndicator.tsx`

**Tasks**:

- [ ] Blue/purple pulsing orb
- [ ] Glass morphism button
- [ ] Animated visualizer bars

### 8.5 Mobile Layout

**Files**:

- `web/src/components/code/mobile/MobileLayout.tsx`
- `web/src/components/code/mobile/SwipePanels.tsx`

**Tasks**:

- [ ] Update all colors
- [ ] Improve touch targets
- [ ] Add swipe indicators

---

## Phase 9: Auth Pages

### 9.1 Login Page

**File**: `web/src/pages/Login.tsx`

**New Design**:

- Centered card with glass effect
- DNA helix background pattern
- Blue CTA button
- Social login options styled

**Tasks**:

- [ ] Glass morphism card
- [ ] Update form styling
- [ ] Add background pattern
- [ ] Update button colors

### 9.2 Signup Page

**File**: `web/src/pages/Signup.tsx`

**Tasks**:

- [ ] Same design system as Login
- [ ] Add tier selection styling
- [ ] Update all form elements

---

## Phase 10: Research & Settings Pages

### 10.1 Research Page

**File**: `web/src/pages/Research.tsx`

**Design**:

- Paper/article cards
- Category filters
- Blue accent highlights

### 10.2 Settings Page

**File**: `web/src/pages/Settings.tsx`

**Design**:

- Tab navigation with underline animation
- Form sections with headers
- Toggle switches with blue accent

---

## Phase 11: Android Native App

### 11.1 Theme System

**File**: `helix-runtime/apps/android/app/src/main/java/ai/openclaw/android/ui/OpenClawTheme.kt`

**Tasks**:

- [ ] Update Material 3 color scheme with Helix colors
- [ ] Primary: #0686D4
- [ ] Secondary: #7234ED
- [ ] Background: #0a0a0a
- [ ] Surface: #111111

### 11.2 Colors XML

**File**: `helix-runtime/apps/android/app/src/main/res/values/colors.xml`

**Tasks**:

- [ ] Add all Helix colors
- [ ] Update launcher background

### 11.3 UI Components

**Files to Update**:

- `StatusPill.kt` - Blue accent
- `ChatSheet.kt` - Glass background
- `TalkOrbOverlay.kt` - Blue/purple orb
- `ChatMessageViews.kt` - Updated colors
- `ChatComposer.kt` - Blue focus states

---

## Phase 12: iOS Native App

### 12.1 Theme Updates

**Files**:

- `helix-runtime/apps/ios/Sources/OpenClawApp.swift`
- `helix-runtime/apps/ios/Sources/RootCanvas.swift`

**Tasks**:

- [ ] Update accent color to #0686D4
- [ ] Update all color references

### 12.2 UI Components

**Files to Update**:

- `StatusPill.swift` - Blue accent
- `ChatSheet.swift` - Glass background
- `TalkOrbOverlay.swift` - Blue/purple orb
- `VoiceTab.swift` - Updated colors
- `SettingsTab.swift` - Updated styling

---

## Phase 13: Logo Integration

### 13.1 Copy Logo Assets

**Source**: `branding/`
**Targets**:

- `web/public/` - Web assets
- `helix-runtime/apps/android/app/src/main/res/` - Android
- `helix-runtime/apps/ios/Sources/Assets.xcassets/` - iOS

**Files to Copy**:

- `PH Horizontal Logo Color White.svg` - Navbar
- `PH Icon Color.svg` - Favicon
- `PH Logomark Color.svg` - Mobile apps
- `PH Main Logo Color White.svg` - Large displays

### 13.2 Favicon Updates

**Tasks**:

- [ ] Generate favicon.ico from PH Icon Color
- [ ] Generate apple-touch-icon.png
- [ ] Generate android-chrome icons
- [ ] Update web manifest

---

## Phase 14: Animation Implementation

### 14.1 CSS Animations

**File**: `web/src/index.css`

Add complete animation library:

```css
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse-glow {
  0%,
  100% {
    box-shadow: 0 0 20px rgba(6, 134, 212, 0.15);
  }
  50% {
    box-shadow: 0 0 40px rgba(6, 134, 212, 0.25);
  }
}

@keyframes shimmer {
  from {
    background-position: -200% 0;
  }
  to {
    background-position: 200% 0;
  }
}

@keyframes float-badge {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes ring-rotate-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes gradient-shift {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  25% {
    transform: translate(10%, 10%) scale(1.05);
  }
  50% {
    transform: translate(-5%, 15%) scale(0.95);
  }
  75% {
    transform: translate(-10%, -5%) scale(1.02);
  }
}

@keyframes hero-reveal {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 14.2 DNA Helix Component

Create new component: `web/src/components/hero/DNAHelix.tsx`

Animated SVG visualization with:

- 3 rotating rings at different speeds
- Glowing data points
- Responsive sizing
- Accessibility support (reduced motion)

---

## Phase 15: Accessibility

### 15.1 High Contrast Mode

**Tasks**:

- [ ] Add `.high-contrast` class support
- [ ] Increase text contrast ratios
- [ ] Strengthen border visibility
- [ ] Add focus outlines

### 15.2 Reduced Motion

**Tasks**:

- [ ] Add `@media (prefers-reduced-motion)` queries
- [ ] Disable animations for accessibility
- [ ] Maintain functionality without motion

---

## Phase 16: Testing & QA

### 16.1 Visual Regression

**Tasks**:

- [ ] Screenshot all pages before changes
- [ ] Screenshot all pages after changes
- [ ] Compare and document differences

### 16.2 Cross-Browser Testing

**Browsers**:

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### 16.3 Mobile Testing

**Devices**:

- [ ] iPhone (Safari)
- [ ] Android (Chrome)
- [ ] iPad (Safari)

### 16.4 Performance

**Tasks**:

- [ ] Lighthouse audit
- [ ] Bundle size check
- [ ] Font loading optimization

---

## Implementation Order

### Week 1: Foundation

1. [x] Analyze SpectroTS design system
2. [x] Analyze current Helix styling
3. [ ] Create design system document
4. [ ] Update `tailwind.config.js`
5. [ ] Update `web/src/index.css`
6. [ ] Copy logo assets

### Week 2: Core Components

7. [ ] Navbar redesign
8. [ ] Footer redesign
9. [ ] Button component updates
10. [ ] Card component updates
11. [ ] Form component updates

### Week 3: Landing Page

12. [ ] Hero section complete redesign
13. [ ] DNA Helix visualization
14. [ ] Features section redesign
15. [ ] Live stats section
16. [ ] Pricing preview
17. [ ] CTA section

### Week 4: Other Pages

18. [ ] Pricing page
19. [ ] Dashboard page
20. [ ] Observatory page
21. [ ] Code interface
22. [ ] Auth pages
23. [ ] Settings page

### Week 5: Native Apps

24. [ ] Android theme system
25. [ ] Android components
26. [ ] iOS theme system
27. [ ] iOS components

### Week 6: Polish

28. [ ] Animation refinement
29. [ ] Accessibility audit
30. [ ] Cross-browser testing
31. [ ] Performance optimization
32. [ ] Final QA

---

## File Change Summary

| Category       | Files | Priority |
| -------------- | ----- | -------- |
| Config         | 2     | Critical |
| Layout         | 2     | High     |
| Landing        | 3     | High     |
| Pages          | 8     | Medium   |
| Code Interface | 11    | Medium   |
| Auth           | 2     | Medium   |
| Android        | 15+   | Low      |
| iOS            | 10+   | Low      |
| Assets         | 10+   | High     |

**Total Estimated Changes**: 60+ files

---

## Success Metrics

1. **Visual Consistency**: All pages use the Void Pulse color palette
2. **Brand Recognition**: Helix DNA logo visible on all key touchpoints
3. **Animation Quality**: Smooth 60fps animations on all platforms
4. **Accessibility**: WCAG 2.1 AA compliance
5. **Performance**: Lighthouse score > 90
6. **Cross-Platform**: Consistent experience on web, iOS, Android

---

## Notes

- Keep existing functionality intact during rebrand
- Test each component in isolation before integration
- Maintain backwards compatibility with existing sessions
- Document all color tokens for future reference
- Consider dark/light mode support for future (currently dark-only)
