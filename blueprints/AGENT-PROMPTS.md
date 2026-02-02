# Helix Desktop - Parallel Agent Prompts

Use these prompts to run 4 agents in parallel. Each agent has a focused scope.

## Dependency Notes

```
┌─────────────┐     ┌─────────────┐
│  Agent A    │     │  Agent C    │
│  (UI/React) │     │ (Onboarding)│
└─────────────┘     └─────────────┘
      │                    │
      │    Independent     │
      ▼                    ▼
┌─────────────┐     ┌─────────────┐
│  Agent B    │     │  Agent D    │
│  (OpenClaw) │     │   (CI/CD)   │
└─────────────┘     └─────────────┘
      │
      ▼
   Chat works!
```

**Safe to run in parallel**: A, C, D
**Agent B**: Can start in parallel but provides working chat when complete

---

## Agent A: Desktop UI Completion (Blueprint 02)

```
You are implementing the Helix Desktop React frontend.

## Context
- Working directory: c:\Users\Specter\Desktop\Helix\helix-desktop
- Tech: React 19, TypeScript, Vite, Tauri 2
- Existing: Basic hooks (useGateway, useConfig, useKeyring, useSystem), chat components, onboarding
- Blueprint: blueprints/02-DESKTOP-APP.md

## Your Tasks

### 1. Router Setup
Install react-router-dom and create routes:
- src/routes/index.tsx - Route definitions with lazy loading
- src/routes/Chat.tsx - Main chat (wrap existing ChatInterface)
- src/routes/Settings.tsx - Settings page
- src/routes/Psychology.tsx - Psychology visualization
- src/routes/Memory.tsx - Memory browser
Update App.tsx to use BrowserRouter

### 2. Zustand Stores
Install zustand and create:
- src/stores/chatStore.ts - messages, sessions, current session
- src/stores/configStore.ts - config state with persistence
- src/stores/sessionStore.ts - session management
- src/stores/uiStore.ts - sidebar open, active panel, theme

### 3. Additional Hooks
Create these hooks:
- src/hooks/useStreaming.ts - Process gateway message stream
- src/hooks/usePsychology.ts - Load and observe psychology layers
- src/hooks/useSession.ts - Session CRUD operations
- src/hooks/useTheme.ts - Dark/light mode with system detection

### 4. Settings Panels
Create settings UI at src/components/settings/:
- SettingsLayout.tsx - Sidebar + content layout
- GeneralSettings.tsx - App name, language, startup behavior
- ModelSettings.tsx - API provider, model selection, temperature
- PrivacySettings.tsx - Telemetry, local storage options
- PsychologySettings.tsx - Enable/disable layers, integration schedule

### 5. Side Panels
Create src/components/panels/:
- PanelContainer.tsx - Resizable panel container
- ThinkingPanel.tsx - Show Claude's thinking
- TerminalPanel.tsx - Show tool executions

## Constraints
- Use existing CSS variables from App.css
- Follow existing component patterns
- Export all new components from index files
- Add TypeScript types for all props

## Do NOT
- Modify Rust backend
- Touch helix-engine
- Change onboarding flow
```

---

## Agent B: OpenClaw Integration (Blueprint 03)

```
You are integrating the OpenClaw engine into helix-engine to make chat work.

## Context
- Working directory: c:\Users\Specter\Desktop\Helix
- Source: helix-runtime/ (existing OpenClaw code)
- Target: helix-engine/ (Helix engine we're building)
- Blueprint: blueprints/03-OPENCLAW-INTEGRATION.md

## Your Tasks

### 1. Analyze OpenClaw Structure
First, explore helix-runtime/src/ to understand:
- Gateway implementation (src/gateway/)
- Agent runner (src/agents/)
- Plugin system (src/plugins/)
- Hook system (src/hooks/)
- Skill loader (src/skills/)

### 2. Copy Core Modules
Copy these directories from helix-runtime/src/ to helix-engine/src/:
- gateway/ (keep our server.ts, merge protocol handling)
- agents/ (agent-runner, model-auth, bootstrap)
- plugins/ (registry, loader)
- hooks/ (registry, executor)
- skills/ (loader, registry)
- memory/ (search, vector-store if exists)

### 3. Remove CLI Dependencies
After copying, remove:
- Any CLI parsing (commander.js usage)
- TUI components
- Interactive prompts
- "openclaw" branding in user-visible strings

### 4. Wire Agent to Gateway
Update helix-engine/src/gateway/server.ts:
- Import agent runner from agents/
- On 'chat' message: create/resume agent session
- Stream agent responses back via WebSocket
- Handle tool calls and results
- Integrate psychology context loading

### 5. Update Dependencies
Update helix-engine/package.json with any new dependencies from helix-runtime/package.json that are needed for agents.

### 6. Test
Ensure `npm run build` succeeds in helix-engine/

## Constraints
- Keep the Helix branding layer (src/helix/branding/)
- Preserve our config schema (merge, don't replace)
- Keep our psychology system integration
- Keep Discord logging hooks

## Do NOT
- Copy CLI entry point
- Copy TUI components
- Copy web UI (we have Tauri frontend)
- Change the Gateway entry point signature
```

---

## Agent C: Onboarding Enhancement (Blueprint 04)

```
You are enhancing the Helix onboarding wizard.

## Context
- Working directory: c:\Users\Specter\Desktop\Helix\helix-desktop
- Existing: 5-step wizard (Welcome, ApiKey, Discord, Privacy, Complete)
- Blueprint: blueprints/04-ONBOARDING-WIZARD.md

## Your Tasks

### 1. Add Account Step (Optional)
Create src/components/onboarding/steps/AccountStep.tsx:
- Option to create/login to Helix account
- "Skip" option clearly visible (default path)
- Benefits explanation (sync, cloud backup)
- OAuth buttons (Google, GitHub) - UI only, no backend yet

### 2. Add Personality Step
Create src/components/onboarding/steps/PersonalityStep.tsx:
- Slider or selection for communication style (casual ↔ formal)
- Toggle for emoji usage
- Toggle for humor level
- Brief personality preview

### 3. Add First Chat Step
Create src/components/onboarding/steps/FirstChatStep.tsx:
- Embedded mini chat interface
- Pre-filled "Hello Helix!" message
- Show Helix responding (can be mocked for now)
- "Continue to main app" button after first exchange

### 4. Update Flow
Modify src/components/onboarding/Onboarding.tsx:
- Add new steps: Welcome → ApiKey → Discord → Account → Personality → Privacy → FirstChat → Complete
- Make Account step skippable
- Update progress bar for 8 steps

### 5. Enhance Welcome Step
Update WelcomeStep.tsx:
- Add animated Helix logo (CSS animation)
- Add "Learn More" link that opens browser
- Improve feature descriptions

### 6. Add Skip Functionality
Update all optional steps with:
- Clear "Skip" button
- Explanation of what skipping means
- Easy way to configure later in Settings

## Constraints
- Match existing CSS styling
- Keep mobile-friendly (responsive)
- Maintain accessibility (keyboard nav, screen readers)
- Don't break existing step functionality

## Do NOT
- Implement actual OAuth (just UI)
- Implement actual account backend
- Modify the Rust backend
- Change the config schema
```

---

## Agent D: Distribution & CI/CD (Blueprint 05)

```
You are setting up build, packaging, and CI/CD for Helix Desktop.

## Context
- Working directory: c:\Users\Specter\Desktop\Helix
- App: helix-desktop/ (Tauri 2 + React)
- Engine: helix-engine/ (Node.js)
- Blueprint: blueprints/05-DISTRIBUTION.md

## Your Tasks

### 1. Node.js Bundling Script
Create helix-desktop/scripts/bundle-node.js:
- Download Node.js 22 LTS binaries for each platform
- Extract to helix-desktop/src-tauri/resources/node/{platform}/
- Platforms: win-x64, darwin-x64, darwin-arm64, linux-x64
- Make script idempotent (skip if already downloaded)

### 2. Enhanced Engine Build
Update helix-desktop/scripts/build-engine.js:
- Build helix-engine for production
- Copy to src-tauri/resources/helix-engine/
- Include only dist/ and node_modules/
- Prune dev dependencies

### 3. GitHub Actions - Build
Create .github/workflows/build.yml:
- Trigger: push to main, PRs
- Matrix: windows-latest, macos-latest, ubuntu-latest
- Steps: checkout, setup node, setup rust, install deps, build
- Upload artifacts

### 4. GitHub Actions - Release
Create .github/workflows/release.yml:
- Trigger: tags v*
- Build all platforms
- Create GitHub release
- Upload installers as release assets
- Generate changelog from commits

### 5. Tauri Bundle Configuration
Update helix-desktop/src-tauri/tauri.conf.json bundle section:
- Add resources paths
- Configure Windows NSIS settings
- Configure macOS settings
- Configure Linux AppImage/deb settings

### 6. Windows Installer
Create helix-desktop/installers/windows/:
- helix-installer.nsi (NSIS script from blueprint)
- Desktop and Start Menu shortcuts
- URL protocol registration (helix://)
- Uninstaller

### 7. Documentation
Create helix-desktop/BUILD.md:
- Prerequisites (Rust, Node, VS Build Tools)
- Development setup steps
- Building for each platform
- Creating releases

## Constraints
- Use npm (not pnpm) for commands
- Support Windows, macOS (Intel + ARM), Linux
- Keep bundle size reasonable
- Don't include dev dependencies in bundles

## Do NOT
- Implement auto-updater yet (just config)
- Set up actual code signing (just placeholders)
- Deploy to production servers
- Modify application source code
```

---

## Running the Agents

### Option 1: Full Parallel (Fastest)

Run all 4 simultaneously. Agent B will provide working chat when done.

### Option 2: Staged Parallel (Safer)

1. First wave: Agent A + C + D (UI, onboarding, CI/CD)
2. Second wave: Agent B (OpenClaw integration)
3. Final: Integration testing

### Option 3: Sequential (Most Controlled)

B → A → C → D
(Gets working chat first, then enhances UI)

### Recommended: Option 1

All agents can work on different files. Merge conflicts are unlikely.
