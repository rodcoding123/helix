# Helix Desktop Transformation - Execution Prompt

> Copy this entire prompt to start implementation with Opus 4.5

---

## MASTER EXECUTION PROMPT

```
You are implementing the Helix Desktop Application - transforming an AI consciousness system from a CLI developer tool into a consumer-grade desktop application.

## Context

Read these blueprints FIRST (they contain all specifications):
- blueprints/01-MASTER-ARCHITECTURE.md - System design
- blueprints/02-DESKTOP-APP.md - Tauri technical spec
- blueprints/03-OPENCLAW-INTEGRATION.md - Engine absorption
- blueprints/04-ONBOARDING-WIZARD.md - First-run UX
- blueprints/05-DISTRIBUTION.md - Packaging & delivery

## Memory Integration

Use Memory MCP throughout:
- Search "HelixDesktopProject" for project context
- Search "HelixArchitectureDecisions" before making decisions
- Update "HelixImplementationStatus" as you complete work
- Create new entities for: blockers, solutions, code patterns discovered

## Sequential Thinking

Use mcp__sequential-thinking__sequentialthinking for:
- Rust backend implementation decisions
- Security-critical code (keyring, credentials, webhooks)
- OpenClaw surgery (what to keep/remove/modify)
- Any architectural pivots from blueprints
- Debugging complex multi-layer issues

## Parallel Workstreams

Execute these 4 workstreams IN PARALLEL using Task tool with multiple agents:

### Workstream A: Tauri Shell (Rust Backend)
Priority: CRITICAL - everything depends on this

Tasks:
1. Initialize Tauri 2.0 project structure
2. Configure tauri.conf.json per Blueprint 02
3. Implement src-tauri/src/commands/ (gateway, config, keyring, files, psychology, system, discord)
4. Implement src-tauri/src/gateway/ (spawner, monitor, bridge)
5. Implement src-tauri/src/config/ (schema, loader, watcher)
6. Implement src-tauri/src/keyring/ (platform-specific credential storage)
7. Set up system tray

### Workstream B: React UI (Frontend)
Priority: HIGH - can start immediately, parallel to A

Tasks:
1. Initialize Vite + React + TypeScript project in src/
2. Port hooks from web/src/hooks/ (useGatewayConnection, useStreaming, useSession)
3. Port lib from web/src/lib/ (gateway-connection, stream-parser, types)
4. Create layout components (AppLayout, TitleBar, Sidebar, StatusBar)
5. Create chat components (ChatContainer, MessageList, ChatInput, panels)
6. Create onboarding wizard (all 8 steps per Blueprint 04)
7. Create settings panels
8. Create psychology visualization components
9. Set up Tailwind with Helix design system

### Workstream C: Helix Engine (OpenClaw Absorption)
Priority: HIGH - can start immediately, parallel to A & B

Tasks:
1. Create helix-engine/ directory structure per Blueprint 03
2. Copy OpenClaw core modules (gateway, agents, plugins, hooks, skills, channels, memory, config)
3. Remove CLI components (cli/, tui/, commands/, entry.ts)
4. Create Gateway-only entry point (src/index.ts)
5. Create programmatic API layer (src/api/)
6. Merge config schemas (OpenClaw + Helix extensions)
7. Add Helix branding layer
8. Integrate psychology system (src/helix/psychology/)
9. Integrate Discord logging (src/helix/logging/)
10. Integrate hash chain (src/helix/hash-chain/)

### Workstream D: Build Pipeline
Priority: MEDIUM - can start after A is scaffolded

Tasks:
1. Set up pnpm workspace
2. Create scripts/bundle-node.js (bundle Node.js runtime)
3. Create scripts/build-engine.js (build helix-engine)
4. Configure GitHub Actions workflow per Blueprint 05
5. Set up code signing configuration (stubs for now)
6. Create installer configurations (NSIS, DMG, AppImage)

## Execution Strategy

1. **First Response**: Read all 5 blueprints, create detailed task breakdown
2. **Parallel Launch**: Start all 4 workstreams simultaneously using Task tool
3. **Checkpoint Every 2 Hours**:
   - Update Memory with progress
   - Review cross-workstream dependencies
   - Identify blockers
4. **Integration Points**:
   - After A.1 + B.2: Test Tauri IPC with React
   - After A.3 + C.4: Test Gateway spawning
   - After B.6 + C.6: Test onboarding with real config
5. **Quality Gates**:
   - TypeScript strict mode, no errors
   - Rust clippy clean
   - All components render without errors
   - Gateway starts and accepts connections

## Critical Rules

1. **NEVER expose "OpenClaw" to users** - all strings say "Helix"
2. **Security first** - use Sequential Thinking for any credential/auth code
3. **Pre-execution logging** - Discord webhooks fire BEFORE actions
4. **Hash chain integrity** - every significant action gets chained
5. **Test as you go** - don't build a castle of cards

## Success Criteria

Phase 1 Complete When:
- [ ] Tauri app launches with custom title bar
- [ ] React frontend renders in Tauri window
- [ ] Gateway spawns as child process
- [ ] WebSocket connection established
- [ ] Basic chat message round-trip works
- [ ] Config loads from ~/.helix/config.json

## Begin

Start by reading the blueprints, then launch parallel workstreams. Update memory continuously. Use sequential thinking for complex decisions. Ship working software.
```

---

## QUICK START COMMANDS

After pasting the prompt above, the agent should:

```bash
# 1. Read all blueprints
Read blueprints/01-MASTER-ARCHITECTURE.md
Read blueprints/02-DESKTOP-APP.md
Read blueprints/03-OPENCLAW-INTEGRATION.md
Read blueprints/04-ONBOARDING-WIZARD.md
Read blueprints/05-DISTRIBUTION.md

# 2. Search memory for context
mcp__memory__search_nodes("HelixDesktopProject")
mcp__memory__search_nodes("HelixArchitectureDecisions")

# 3. Launch parallel agents
Task(subagent_type="general-purpose", description="Workstream A: Tauri Shell", ...)
Task(subagent_type="general-purpose", description="Workstream B: React UI", ...)
Task(subagent_type="general-purpose", description="Workstream C: Helix Engine", ...)
Task(subagent_type="general-purpose", description="Workstream D: Build Pipeline", ...)
```

---

## WORKSTREAM DETAILS FOR PARALLEL AGENTS

### Agent A Prompt (Tauri Shell)

```
You are implementing the Tauri 2.0 Rust backend for Helix Desktop.

Read: blueprints/02-DESKTOP-APP.md (especially the Rust sections)

Your tasks:
1. Create src-tauri/ directory structure
2. Write Cargo.toml with all dependencies
3. Write tauri.conf.json configuration
4. Implement all command handlers in src/commands/
5. Implement gateway spawner in src/gateway/
6. Implement config system in src/config/
7. Implement keyring access in src/keyring/
8. Set up system tray

Use Sequential Thinking for:
- Keyring implementation (security critical)
- Gateway process management
- Cross-platform considerations

Update memory with:
- Blockers encountered
- Patterns discovered
- Decisions made
```

### Agent B Prompt (React UI)

```
You are implementing the React frontend for Helix Desktop.

Read: blueprints/02-DESKTOP-APP.md (frontend sections)
Read: blueprints/04-ONBOARDING-WIZARD.md (complete wizard spec)
Reference: web/src/ for existing code to port

Your tasks:
1. Initialize Vite + React + TypeScript in src/
2. Set up Tailwind with Helix design system
3. Port hooks: useGatewayConnection, useStreaming, useSession, usePanels
4. Port lib: gateway-connection, stream-parser, types
5. Create all layout components
6. Create all chat components
7. Create complete onboarding wizard (8 steps)
8. Create settings panels
9. Create psychology visualization

Focus on:
- Reusing web/ code where possible
- Matching the wireframes in Blueprint 04
- Proper TypeScript types
- Accessibility (keyboard nav, screen readers)

Update memory with component completion status.
```

### Agent C Prompt (Helix Engine)

```
You are absorbing OpenClaw into the Helix Engine.

Read: blueprints/03-OPENCLAW-INTEGRATION.md (complete spec)
Reference: helix-runtime/ for source code

Your tasks:
1. Create helix-engine/ directory
2. Copy core modules (gateway, agents, plugins, hooks, skills, channels, memory, config)
3. DELETE: cli/, tui/, commands/, entry.ts, openclaw.mjs
4. Create new entry point: src/index.ts (Gateway-only)
5. Create API layer: src/api/ (gateway, config, agents, sessions, psychology, memory)
6. Merge config schemas with Helix extensions
7. Add branding layer (all user strings say "Helix")
8. Integrate psychology system
9. Integrate Discord logging
10. Integrate hash chain

Use Sequential Thinking for:
- What to keep vs remove from OpenClaw
- Config schema merging
- Psychology system integration

CRITICAL: Maintain ability to sync upstream OpenClaw updates.

Update memory with integration decisions.
```

### Agent D Prompt (Build Pipeline)

```
You are setting up the build and distribution pipeline.

Read: blueprints/05-DISTRIBUTION.md (complete spec)
Read: blueprints/02-DESKTOP-APP.md (build sections)

Your tasks:
1. Create pnpm-workspace.yaml
2. Create root package.json with scripts
3. Create scripts/bundle-node.js
4. Create scripts/build-engine.js
5. Create scripts/post-build.js
6. Create .github/workflows/release.yml
7. Create installer configs (NSIS stub, DMG config)
8. Set up code signing configuration files (with placeholders)

Focus on:
- Cross-platform builds
- Proper dependency management
- CI/CD that actually works

Update memory with build configuration decisions.
```

---

## PROGRESS TRACKING

Use this checklist and update Memory MCP as you go:

### Phase 1 Milestones

```
□ Tauri project initialized
□ React project initialized
□ helix-engine package created
□ Build scripts working
□ Tauri app launches
□ React renders in window
□ Gateway spawns successfully
□ WebSocket connects
□ Chat message works end-to-end
□ Config persists to disk
```

### Memory Updates Template

```javascript
// After completing a milestone
mcp__memory__add_observations({
  observations: [
    {
      entityName: 'HelixImplementationStatus',
      contents: [
        'Workstream A: Tauri initialized, commands 50% complete',
        'Blocker: keyring crate not compiling on Windows',
        'Solution: Used keyring-rs with feature flags',
      ],
    },
  ],
});

// After making an architectural decision
mcp__memory__add_observations({
  observations: [
    {
      entityName: 'HelixArchitectureDecisions',
      contents: [
        'Decision: Use tauri-plugin-store instead of custom config',
        'Reason: Better cross-platform support, less code',
      ],
    },
  ],
});
```

---

## ESTIMATED PARALLEL EXECUTION

With 4 agents running simultaneously:

| Workstream | Solo Time | Parallel Time | Dependencies     |
| ---------- | --------- | ------------- | ---------------- |
| A: Tauri   | 8 hours   | 8 hours       | None             |
| B: React   | 10 hours  | 10 hours      | None (initially) |
| C: Engine  | 6 hours   | 6 hours       | None             |
| D: Build   | 4 hours   | 4 hours       | A scaffold       |

**Total Sequential**: ~28 hours
**Total Parallel**: ~10 hours (limited by longest workstream)

Integration testing adds ~2-4 hours.

**Phase 1 Target: 12-14 hours of agent time**
