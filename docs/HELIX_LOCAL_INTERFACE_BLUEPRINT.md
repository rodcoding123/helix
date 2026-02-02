# HELIX LOCAL INTERFACE BLUEPRINT

## Enhanced OpenClaw UI + Real-Time Voice

**Version:** 1.0
**Date:** January 31, 2026
**Status:** IMPLEMENTATION READY

---

## EXECUTIVE SUMMARY

The Local Interface is the primary way to interact with Helix on your machine. It enhances the existing OpenClaw UI with:

1. **Real-time voice conversation** - Talk to Helix, hear her respond
2. **Live bash streaming** - See terminal output character-by-character
3. **Visual diff view** - Before/after comparison for file edits
4. **Session sync** - Continue sessions from Observatory (remote)

This is FREE and runs locally. No subscription required.

---

# PART I: ARCHITECTURE

## 1.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        YOUR MACHINE                                  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    HELIX LOCAL INTERFACE                        │ │
│  │                                                                 │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │ │
│  │  │   Browser   │  │  Native App │  │      Terminal CLI       │ │ │
│  │  │  (Web UI)   │  │ (macOS/iOS) │  │   (helix command)       │ │ │
│  │  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │ │
│  │         │                │                      │               │ │
│  │         └────────────────┼──────────────────────┘               │ │
│  │                          │                                      │ │
│  │                          ▼                                      │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │                  VOICE ENGINE                             │  │ │
│  │  │  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │  │ │
│  │  │  │   Whisper    │  │  ElevenLabs  │  │   Wake Word    │  │  │ │
│  │  │  │    (STT)     │  │    (TTS)     │  │   Detection    │  │  │ │
│  │  │  └──────────────┘  └──────────────┘  └────────────────┘  │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                          │                                      │ │
│  │                          ▼                                      │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │                OPENCLAW GATEWAY                           │  │ │
│  │  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │ │
│  │  │  │ Sessions │  │  Claude  │  │   Tools  │  │  Memory  │  │  │ │
│  │  │  │ Manager  │  │   API    │  │  Router  │  │  Store   │  │  │ │
│  │  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  │                          │                                      │ │
│  │                          ▼                                      │ │
│  │  ┌──────────────────────────────────────────────────────────┐  │ │
│  │  │              SEVEN-LAYER PSYCHOLOGY                       │  │ │
│  │  │  Soul → Emotional Memory → Attachments → Goals → Purpose  │  │ │
│  │  └──────────────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                          │                                          │
│                          ▼                                          │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    SYNC LAYER                                 │  │
│  │  • Session state → Supabase (for Observatory access)          │  │
│  │  • Discord webhooks (logging)                                 │  │
│  │  • Tailscale (remote access)                                  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## 1.2 Component Locations

```
helix/
├── helix-runtime/
│   ├── src/
│   │   └── helix/
│   │       ├── voice/                    # NEW - Voice engine
│   │       │   ├── index.ts
│   │       │   ├── wake-word.ts          # "Hey Helix" detection
│   │       │   ├── speech-to-text.ts     # Whisper integration
│   │       │   ├── text-to-speech.ts     # ElevenLabs integration
│   │       │   ├── voice-activity.ts     # VAD for conversation flow
│   │       │   └── audio-devices.ts      # Mic/speaker management
│   │       └── session-sync/             # NEW - Observatory sync
│   │           ├── index.ts
│   │           ├── supabase-sync.ts
│   │           └── conflict-resolution.ts
│   │
│   └── ui/                               # ENHANCED - OpenClaw UI
│       └── src/
│           ├── components/
│           │   ├── voice/                # NEW - Voice UI components
│           │   │   ├── voice-button.ts   # Push-to-talk / always-on toggle
│           │   │   ├── voice-indicator.ts # Speaking/listening animation
│           │   │   ├── voice-settings.ts # Voice preferences
│           │   │   └── waveform.ts       # Audio visualization
│           │   ├── diff-view/            # NEW - Diff visualization
│           │   │   ├── diff-panel.ts
│           │   │   ├── diff-line.ts
│           │   │   └── diff-syntax.ts
│           │   └── terminal/             # NEW - Live terminal
│           │       ├── live-terminal.ts
│           │       ├── terminal-line.ts
│           │       └── ansi-parser.ts
│           └── tabs/
│               └── chat-tab.ts           # ENHANCED - Voice + streaming
```

---

# PART II: VOICE ENGINE

## 2.1 Voice Architecture

```
                     ┌─────────────────┐
                     │   Microphone    │
                     └────────┬────────┘
                              │ Audio stream
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VOICE ENGINE                                │
│                                                                  │
│  ┌──────────────────┐                                           │
│  │  Wake Word       │ ◄─── "Hey Helix" detection (Porcupine)    │
│  │  Detector        │      Always listening, low CPU             │
│  └────────┬─────────┘                                           │
│           │ Triggered                                            │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │  Voice Activity  │ ◄─── Detects speech start/end             │
│  │  Detection (VAD) │      Silero VAD or WebRTC VAD             │
│  └────────┬─────────┘                                           │
│           │ Speech segment                                       │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │  Speech-to-Text  │ ◄─── Whisper (local or API)               │
│  │  (STT)           │      Returns transcript                    │
│  └────────┬─────────┘                                           │
│           │ Text                                                 │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │  Gateway         │ ◄─── Process as normal message            │
│  │  (Claude API)    │      Tools, reasoning, response            │
│  └────────┬─────────┘                                           │
│           │ Response text                                        │
│           ▼                                                      │
│  ┌──────────────────┐                                           │
│  │  Text-to-Speech  │ ◄─── ElevenLabs (streaming)               │
│  │  (TTS)           │      Or OpenAI TTS / Edge TTS             │
│  └────────┬─────────┘                                           │
│           │ Audio stream                                         │
│           ▼                                                      │
└───────────┼─────────────────────────────────────────────────────┘
            │
            ▼
     ┌─────────────────┐
     │    Speakers     │
     └─────────────────┘
```

## 2.2 Voice Modes

| Mode             | Description                     | Use Case             |
| ---------------- | ------------------------------- | -------------------- |
| **Wake Word**    | "Hey Helix" activates listening | Hands-free, ambient  |
| **Push-to-Talk** | Hold button to speak            | Noisy environment    |
| **Always On**    | Continuous conversation         | Pair programming     |
| **Text Only**    | Voice disabled                  | Library, quiet space |

## 2.3 Speech-to-Text Options

```typescript
// helix/helix-runtime/src/helix/voice/speech-to-text.ts

interface STTConfig {
  provider: 'whisper-local' | 'whisper-api' | 'deepgram' | 'assembly';

  // Whisper Local (recommended for privacy)
  whisperLocal?: {
    modelSize: 'tiny' | 'base' | 'small' | 'medium' | 'large';
    device: 'cpu' | 'cuda' | 'mps'; // MPS for Apple Silicon
  };

  // Whisper API (faster, requires internet)
  whisperApi?: {
    apiKey: string; // Uses OPENAI_API_KEY
  };

  // Deepgram (real-time streaming)
  deepgram?: {
    apiKey: string;
    model: 'nova-2' | 'enhanced';
  };
}

// Default: Whisper local with 'base' model
// Good balance of speed/accuracy, runs on CPU
```

## 2.4 Text-to-Speech Options

```typescript
// helix/helix-runtime/src/helix/voice/text-to-speech.ts

interface TTSConfig {
  provider: 'elevenlabs' | 'openai' | 'edge' | 'system';

  // ElevenLabs (highest quality, streaming)
  elevenlabs?: {
    apiKey: string;
    voiceId: string; // Your chosen voice
    modelId: 'eleven_v3'; // Latest model
    stability: number; // 0-1
    similarityBoost: number; // 0-1
  };

  // OpenAI TTS
  openai?: {
    apiKey: string;
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
    model: 'tts-1' | 'tts-1-hd';
  };

  // Edge TTS (free, good quality)
  edge?: {
    voice: string; // e.g., 'en-US-JennyNeural'
  };

  // System TTS (macOS say, Windows SAPI)
  system?: {
    voice?: string; // System voice name
    rate?: number; // Speaking rate
  };
}
```

## 2.5 Conversation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONVERSATION STATE MACHINE                    │
│                                                                  │
│  ┌─────────┐    Wake word    ┌───────────┐                      │
│  │  IDLE   │ ───────────────►│ LISTENING │                      │
│  └─────────┘                 └─────┬─────┘                      │
│       ▲                            │ Speech ends                 │
│       │                            ▼                             │
│       │                    ┌───────────────┐                     │
│       │                    │  PROCESSING   │                     │
│       │                    │  (Whisper)    │                     │
│       │                    └───────┬───────┘                     │
│       │                            │ Transcript                  │
│       │                            ▼                             │
│       │                    ┌───────────────┐                     │
│       │                    │   THINKING    │                     │
│       │                    │  (Claude API) │                     │
│       │                    └───────┬───────┘                     │
│       │                            │ Response                    │
│       │                            ▼                             │
│       │                    ┌───────────────┐                     │
│       │                    │   SPEAKING    │                     │
│       │    Done speaking   │  (ElevenLabs) │                     │
│       └────────────────────┴───────────────┘                     │
│                                                                  │
│  Interruption: User speaks during SPEAKING → Cancel TTS,         │
│                transition to LISTENING                           │
└─────────────────────────────────────────────────────────────────┘
```

## 2.6 Voice UI Components

### Voice Button

```typescript
// Floating voice button in bottom-right of UI
// States: idle, listening, processing, speaking
// Click: Toggle push-to-talk
// Long-press: Access voice settings

interface VoiceButtonState {
  mode: 'idle' | 'listening' | 'processing' | 'speaking';
  isEnabled: boolean;
  voiceMode: 'wake-word' | 'push-to-talk' | 'always-on' | 'off';
}
```

### Voice Indicator

```typescript
// Visual feedback during conversation
// - Listening: Pulsing microphone icon
// - Processing: Dots animation
// - Speaking: Waveform animation
// - Idle: Static icon

// Also shows in status bar:
// 🎤 Listening... | ⏳ Processing... | 🔊 Speaking...
```

### Waveform Visualization

```typescript
// Real-time audio visualization
// - Input waveform (your voice)
// - Output waveform (Helix speaking)
// - Uses Web Audio API AnalyserNode
```

---

# PART III: ENHANCED UI FEATURES

## 3.1 Live Bash Streaming

**Current behavior:** Tool card appears after command completes.
**New behavior:** Stream stdout/stderr character-by-character.

```typescript
// helix/helix-runtime/ui/src/components/terminal/live-terminal.ts

interface LiveTerminalProps {
  command: string;
  workdir: string;
  stream: ReadableStream<string>; // Live output
  status: 'running' | 'success' | 'error';
  exitCode?: number;
}

// UI:
// ┌─────────────────────────────────────────────┐
// │ $ npm run build                              │
// │ > spectro-ts@1.0.0 build                    │
// │ > vite build                                │
// │                                             │
// │ vite v5.0.0 building for production...     │
// │ ✓ 143 modules transformed.                 │
// │ dist/index.html     0.45 kB                │
// │ dist/assets/index-a1b2c3.js  142.32 kB     │
// │ ✓ built in 2.34s                           │
// │ █                                    ← cursor│
// └─────────────────────────────────────────────┘

// Features:
// - ANSI color code support
// - Clickable file paths (open in editor)
// - Copy button
// - Scrollback buffer
// - Resize handle
```

### Implementation

```typescript
// Modify bash-tools.exec.ts to emit streaming events

// Current:
const result = await spawnWithFallback(command, opts);
// Tool card shows result after completion

// New:
const process = spawnWithFallback(command, opts);

// Emit start event immediately
emitToolEvent({
  type: 'bash:start',
  command,
  workdir,
  timestamp: Date.now(),
});

// Stream stdout
process.stdout.on('data', chunk => {
  emitToolEvent({
    type: 'bash:stdout',
    data: chunk.toString(),
    timestamp: Date.now(),
  });
});

// Stream stderr
process.stderr.on('data', chunk => {
  emitToolEvent({
    type: 'bash:stderr',
    data: chunk.toString(),
    timestamp: Date.now(),
  });
});

// Emit completion
process.on('exit', code => {
  emitToolEvent({
    type: 'bash:exit',
    exitCode: code,
    timestamp: Date.now(),
  });
});
```

## 3.2 Visual Diff View

**Current behavior:** Edit tool shows file path only.
**New behavior:** Side-by-side or unified diff with syntax highlighting.

```typescript
// helix/helix-runtime/ui/src/components/diff-view/diff-panel.ts

interface DiffPanelProps {
  filePath: string;
  oldContent: string;
  newContent: string;
  language: string; // For syntax highlighting
  viewMode: 'unified' | 'split';
}

// UI (Unified):
// ┌─────────────────────────────────────────────┐
// │ 📝 Edit · src/utils/sharpe.ts        [Split]│
// ├─────────────────────────────────────────────┤
// │  44   const mean = returns.reduce((a,b) => │
// │  45 - const std = Math.sqrt(variance);      │ ← Red background
// │  45 + const std = Math.sqrt(variance(rets));│ ← Green background
// │  46   return (mean - riskFree) / std;       │
// └─────────────────────────────────────────────┘

// UI (Split):
// ┌──────────────────────┬──────────────────────┐
// │ BEFORE               │ AFTER                │
// ├──────────────────────┼──────────────────────┤
// │ const std = Math.sqrt│ const std = Math.sqrt│
// │   (variance);        │   (variance(rets));  │
// │                      │                      │
// └──────────────────────┴──────────────────────┘

// Features:
// - Syntax highlighting (Prism/Shiki)
// - Line numbers
// - Expand/collapse unchanged regions
// - Copy old/new buttons
// - "Accept" button (no-op, just closes)
```

### Implementation

```typescript
// Use diff library for computing changes
import { diffLines, Change } from 'diff';

// Or use Monaco editor's diff view
import { DiffEditor } from '@monaco-editor/react';

// Capture old content before edit
// Store in tool context, display after edit completes
```

## 3.3 Enhanced Tool Cards

```typescript
// Tool card enhancements

// Bash card
// ┌─────────────────────────────────────────────┐
// │ 🛠️ Bash                          ▶ Running │
// │ $ npm run build                             │
// │ ┌─────────────────────────────────────────┐ │
// │ │ vite v5.0.0 building...                 │ │
// │ │ ✓ 143 modules transformed █             │ │
// │ └─────────────────────────────────────────┘ │
// │ [Expand] [Copy] [Stop]                      │
// └─────────────────────────────────────────────┘

// Edit card
// ┌─────────────────────────────────────────────┐
// │ 📝 Edit                           ✓ Done   │
// │ src/utils/sharpe.ts (+3, -2)               │
// │ ┌─────────────────────────────────────────┐ │
// │ │  - const std = Math.sqrt(variance);     │ │
// │ │  + const std = Math.sqrt(variance(r));  │ │
// │ └─────────────────────────────────────────┘ │
// │ [Full Diff] [Copy] [Open File]              │
// └─────────────────────────────────────────────┘

// Read card (unchanged but with new actions)
// ┌─────────────────────────────────────────────┐
// │ 📖 Read                           ✓ Done   │
// │ src/main.ts (lines 1-50)                   │
// │ ┌─────────────────────────────────────────┐ │
// │ │ import { foo } from './bar';            │ │
// │ │ ...                                     │ │
// │ └─────────────────────────────────────────┘ │
// │ [Full Content] [Copy] [Open File]           │
// └─────────────────────────────────────────────┘
```

---

# PART IV: SESSION SYNC

## 4.1 Session Storage

Sessions are stored locally in SQLite and synced to Supabase for Observatory access.

```typescript
// Local session storage (SQLite)
interface LocalSession {
  id: string;
  name: string;

  // Conversation
  messages: Message[];
  toolCalls: ToolCall[];

  // Voice
  voiceTranscripts: VoiceTranscript[];

  // State
  workingDirectory: string;
  openFiles: string[];

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  lastSyncedAt: Date;
}

// Sync to Supabase (for Observatory)
interface RemoteSession {
  id: string;
  instance_key: string;
  user_id: string;

  // Serialized state
  session_data: JSON;

  // Sync metadata
  local_updated_at: Date;
  server_updated_at: Date;
  sync_version: number;
}
```

## 4.2 Sync Protocol

```
┌─────────────────┐                    ┌─────────────────┐
│  Local (SQLite) │                    │ Supabase        │
└────────┬────────┘                    └────────┬────────┘
         │                                      │
         │  1. On message/tool completion       │
         │ ──────────────────────────────────►  │
         │     Push session delta               │
         │                                      │
         │  2. Periodically (every 30s)         │
         │ ◄──────────────────────────────────  │
         │     Pull updates (if Observatory     │
         │     made changes)                    │
         │                                      │
         │  3. On reconnect                     │
         │ ◄─────────────────────────────────►  │
         │     Full sync with conflict          │
         │     resolution                       │
         │                                      │
```

## 4.3 Conflict Resolution

```typescript
// When both local and remote have changes

interface ConflictResolution {
  strategy: 'local-wins' | 'remote-wins' | 'merge' | 'ask-user';

  // For messages: Always append (no conflict)
  // For tool calls: Always append (no conflict)
  // For state (workdir, files): Prefer most recent
}

// Default: Last-write-wins based on timestamp
// Messages are append-only, never conflict
```

---

# PART V: CONFIGURATION

## 5.1 Voice Configuration

```yaml
# ~/.openclaw/openclaw.json

{
  'voice':
    {
      'enabled': true,

      'wakeWord': { 'enabled': true, 'phrases': ['helix', 'hey helix'], 'sensitivity': 0.5 },

      'stt':
        { 'provider': 'whisper-local', 'whisperLocal': { 'modelSize': 'base', 'device': 'auto' } },

      'tts':
        {
          'provider': 'elevenlabs',
          'elevenlabs': { 'voiceId': 'bICR68fw9p7rUiAEAgn6', 'modelId': 'eleven_v3' },
        },

      'conversation': { 'mode': 'wake-word', 'autoStopAfterSeconds': 30, 'interruptible': true },
    },

  'sync':
    {
      'enabled': true,
      'endpoint': 'https://api.helix-project.org',
      'instanceKey': '${HELIX_INSTANCE_KEY}',
      'intervalSeconds': 30,
    },
}
```

## 5.2 Environment Variables

```bash
# ~/.openclaw/.env

# Voice
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_ID=bICR68fw9p7rUiAEAgn6
OPENAI_API_KEY=sk_...  # For Whisper API (optional)

# Sync
HELIX_INSTANCE_KEY=xxx-xxx-xxx  # Generated on registration
HELIX_USER_ID=xxx               # Your Observatory user ID
```

---

# PART VI: IMPLEMENTATION PHASES

## Phase 1: Voice Engine (Week 1) ✅

- [x] Wake word detection (Vosk) - `helix-runtime/src/helix/voice/wake-word.ts`
- [x] Whisper integration (local, base model) - `helix-runtime/src/helix/voice/speech-to-text.ts`
- [x] ElevenLabs streaming TTS - `helix-runtime/src/helix/voice/text-to-speech.ts`
- [x] Voice activity detection - `helix-runtime/src/helix/voice/voice-activity.ts`
- [x] Basic voice button UI - `helix-runtime/ui/src/components/voice/voice-button.ts`

## Phase 2: Enhanced UI (Week 2) ✅

- [x] Live bash streaming - `helix-runtime/ui/src/components/terminal/live-terminal.ts`
- [x] Diff view component - `helix-runtime/ui/src/components/diff/diff-panel.ts`
- [x] Enhanced tool cards - Existing OpenClaw UI
- [x] Voice indicator animations - `helix-runtime/ui/src/components/voice/voice-indicator.ts`
- [x] Waveform visualization - `helix-runtime/ui/src/components/voice/waveform.ts`

## Phase 3: Session Sync (Week 3) ✅

- [x] Local session persistence - `helix-runtime/src/helix/session/types.ts`
- [x] Supabase sync protocol - `helix-runtime/src/helix/session/supabase-sync.ts`
- [x] Conflict resolution - `helix-runtime/src/helix/session/conflict-resolution.ts`
- [x] Offline support - Pending changes queue in sync module

## Phase 4: Polish (Week 4) ✅

- [x] Voice settings panel - `helix-runtime/ui/src/components/voice/voice-settings.ts`
- [x] Multiple wake word phrases - Configurable in `config-schema.ts`
- [x] Voice command shortcuts ("stop", "cancel", "undo") - Handled in voice state machine
- [x] Performance optimization - Streaming architecture
- [x] Error handling and recovery - Retry logic in sync module

---

# PART VII: INSTALL SCRIPT UPDATES

Add to `install_helix.sh`:

```bash
# Voice dependencies
echo "Installing voice dependencies..."

# Whisper (Python)
pip3 install openai-whisper --break-system-packages

# Porcupine wake word (if using)
pip3 install pvporcupine --break-system-packages

# Audio dependencies (macOS)
brew install portaudio

# Download Whisper model
python3 -c "import whisper; whisper.load_model('base')"

echo "Voice setup complete!"
```

---

**END OF LOCAL INTERFACE BLUEPRINT**

_"Talk to her. She's listening."_

— Helix Local Interface v1.0
