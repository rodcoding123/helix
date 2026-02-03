# Phase 3 Desktop Porting Strategy

**Target**: Week 2 (40 hours)
**Goal**: Desktop feature parity with web for Phase 3

---

## Structure Overview

### Desktop App Architecture

```
helix-desktop/
├── src/
│   ├── pages/                    (Route pages)
│   ├── routes/                   (Router definitions)
│   ├── components/               (Feature components)
│   ├── hooks/                    (Custom React hooks)
│   ├── lib/                      (Utilities & services)
│   └── stores/                   (Global state)
├── src-tauri/                    (Rust backend for native features)
└── App.tsx (main router)
```

### Web App Structure (for reference)

```
web/src/
├── pages/                        (Route pages)
├── components/                   (Feature components)
├── hooks/                        (React hooks - reusable!)
├── services/                     (API services)
└── lib/types/                    (Type definitions)
```

---

## Key Differences: Web vs Desktop

| Aspect            | Web              | Desktop             | Strategy                |
| ----------------- | ---------------- | ------------------- | ----------------------- |
| **Auth**          | Supabase browser | Session-based       | Use same gateway client |
| **Services**      | API calls        | Gateway RPC         | Adapt to gateway client |
| **File Upload**   | HTML `<input>`   | Native file dialog  | Use Tauri file picker   |
| **Storage**       | Supabase         | Local + Tauri       | Use AppData folder      |
| **Notifications** | Browser toast    | Tauri notifications | Use Tauri API           |
| **Code Editor**   | Monaco or simple | Monaco              | Same library            |

---

## Porting Strategy: 3-Phase Approach

### Phase A: Setup Foundation (4 hours)

- [ ] Create Phase 3 component directories
- [ ] Create Phase 3 route entries
- [ ] Create desktop hooks that mirror web hooks
- [ ] Verify gateway client works in desktop

### Phase B: Port Components (24 hours)

- [ ] Port CustomTools components
- [ ] Port CompositeSkills components
- [ ] Port MemorySynthesis components
- [ ] Adapt for desktop UI/UX

### Phase C: Desktop-Specific Features (12 hours)

- [ ] Native file dialogs for tool import/export
- [ ] Desktop notifications for job completion
- [ ] Tauri menu integration
- [ ] Testing on macOS, Windows, Linux

---

## Implementation Plan

### STEP 1: Create Component Directories

```bash
mkdir -p src/components/tools
mkdir -p src/components/skills
mkdir -p src/components/synthesis
```

### STEP 2: Create Desktop Hooks

These will be SHARED with web through symlinks or shared package:

```typescript
// src/hooks/useCustomTools.ts (desktop version)
// src/hooks/useCompositeSkills.ts
// src/hooks/useMemorySynthesis.ts

// Key adaptation: Replace fetch() with gateway RPC client
```

### STEP 3: Create Route Pages

```typescript
// Add to src/routes/index.tsx:
const CustomTools = lazy(() => import('./CustomTools'));
const CompositeSkills = lazy(() => import('./CompositeSkills'));
const MemorySynthesis = lazy(() => import('./MemorySynthesis'));

// Add to router config:
{
  path: 'tools',
  element: <CustomTools />
},
{
  path: 'skills',
  element: <CompositeSkills />
},
{
  path: 'synthesis',
  element: <MemorySynthesis />
}
```

### STEP 4: Port Components

**Source**: `web/src/pages/*.tsx`
**Target**: `helix-desktop/src/routes/*.tsx`

**Adaptations**:

- Remove Supabase dependencies
- Replace API calls with gateway RPC
- Replace `useAuth()` with desktop auth
- Replace file uploads with Tauri file picker
- Update styling for desktop layout

### STEP 5: Add Desktop Navigation

Update `AppLayout` navigation to include Phase 3 items:

- Tools
- Skills
- Synthesis

---

## File Mapping: Web → Desktop

### Custom Tools

| Web                        | Desktop                   | Type  |
| -------------------------- | ------------------------- | ----- |
| `pages/CustomTools.tsx`    | `routes/CustomTools.tsx`  | Port  |
| `components/tools/`        | `components/tools/`       | Port  |
| `hooks/useCustomTools.ts`  | `hooks/useCustomTools.ts` | Adapt |
| `services/custom-tools.ts` | (integrated in hook)      | Adapt |

### Composite Skills

| Web                            | Desktop                       | Type  |
| ------------------------------ | ----------------------------- | ----- |
| `pages/CompositeSkills.tsx`    | `routes/CompositeSkills.tsx`  | Port  |
| `hooks/useCompositeSkills.ts`  | `hooks/useCompositeSkills.ts` | Adapt |
| `services/composite-skills.ts` | (integrated in hook)          | Adapt |

### Memory Synthesis

| Web                            | Desktop                       | Type  |
| ------------------------------ | ----------------------------- | ----- |
| `pages/MemorySynthesis.tsx`    | `routes/MemorySynthesis.tsx`  | Port  |
| `hooks/useMemorySynthesis.ts`  | `hooks/useMemorySynthesis.ts` | Adapt |
| `services/memory-synthesis.ts` | (integrated in hook)          | Adapt |

---

## Desktop-Specific Adaptations

### File Dialogs (Tauri)

```typescript
import { open } from '@tauri-apps/api/dialog';

const handleImportTool = async () => {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (selected && typeof selected === 'string') {
    const fileContent = await readTextFile(selected);
    // Process...
  }
};
```

### Notifications (Tauri)

```typescript
import { sendNotification } from '@tauri-apps/api/notification';

sendNotification({
  title: 'Tool Execution Complete',
  body: 'Your tool completed successfully',
});
```

### Menu Integration (Tauri)

```rust
// src-tauri/src/main.rs
// Add menu items for Phase 3 features
// - Tools → New Tool, Browse Tools
// - Skills → New Skill, Browse Skills
// - Synthesis → Run Synthesis
```

---

## Testing Strategy

### Unit Tests

- [ ] Custom tool creation/validation
- [ ] Composite skill building
- [ ] Memory synthesis job submission

### Integration Tests

- [ ] Create tool → Execute tool
- [ ] Create skill → Execute skill
- [ ] Run synthesis → View patterns

### Platform Tests

- [ ] macOS: all features work
- [ ] Windows: all features work
- [ ] Linux: all features work

### Performance Tests

- [ ] Tool execution time < 1s
- [ ] Skill execution time < 5s
- [ ] Synthesis job tracking works

---

## UI/UX Adjustments for Desktop

1. **Sidebar Navigation**: Add Phase 3 items to main nav
2. **Modal Handling**: Use Tauri dialogs instead of React modals
3. **Drag & Drop**: Native file drag-drop support
4. **Keyboard Shortcuts**: Desktop-specific shortcuts
5. **Window Management**: Multi-window support for tool editor

---

## Timeline: Week 2

### Day 1-2: Setup + Custom Tools

- Create directories and routes
- Port CustomTools page
- Test component integration
- Fix styling issues

### Day 3-4: Composite Skills

- Port CompositeSkills page
- Adapt skill builder for desktop
- Test multi-step execution

### Day 5: Memory Synthesis

- Port MemorySynthesis page
- Integrate database queries
- Test synthesis job flow

### Day 6-7: Polish + Testing

- Desktop-specific features (file dialogs, notifications)
- Cross-platform testing (Mac, Windows, Linux)
- Performance optimization
- Documentation

---

## Success Criteria

- [ ] All 3 Phase 3 pages render on desktop
- [ ] Custom tools can be created and executed
- [ ] Composite skills can be built and executed
- [ ] Memory synthesis jobs submit successfully
- [ ] Desktop UI is consistent with desktop theme
- [ ] File dialogs work for import/export
- [ ] Notifications work for job completion
- [ ] Tested on macOS, Windows, Linux
- [ ] Performance acceptable (< 2s for most operations)
- [ ] No runtime errors in console

---

## Risk Mitigation

| Risk                                | Impact | Mitigation                   |
| ----------------------------------- | ------ | ---------------------------- |
| Gateway client incompatibility      | HIGH   | Test early (Day 1)           |
| UI layout issues on smaller screens | MEDIUM | Add responsive CSS           |
| File dialog permission issues       | MEDIUM | Handle errors gracefully     |
| Performance degradation             | MEDIUM | Implement lazy loading       |
| Cross-platform incompatibility      | LOW    | Use cross-platform libraries |

---

## Rollback Plan

If desktop porting encounters blockers:

1. Use mock gateway responses
2. Implement API bridge in Node.js
3. Fall back to web UI in webview
4. Defer complex features to later sprint

---

## Dependencies & Prerequisites

Already available:

- ✅ React Router (router setup exists)
- ✅ React hooks pattern
- ✅ Tauri API (file dialogs, notifications)
- ✅ Gateway client

Need to add:

- Code editor (Monaco or CodeMirror)
- JSON editor for skill definitions
- Charts for synthesis results

---

_Desktop Porting Strategy v1.0 | February 2, 2026_
