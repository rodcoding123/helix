# HELIX OBSERVATORY CODE INTERFACE BLUEPRINT

## Remote Coding with Real-Time Voice

**Version:** 1.0
**Date:** January 31, 2026
**Status:** IMPLEMENTATION READY
**Tier:** Observatory Pro ($99/mo)

---

## EXECUTIVE SUMMARY

The Observatory Code Interface is the remote/cloud way to interact with Helix from anywhere:

1. **Browser-based coding interface** - helix-project.org/code
2. **Real-time voice via WebRTC** - Talk from phone or laptop
3. **Session continuity** - Same session as local, seamless handoff
4. **Mobile-optimized** - Full experience on phone

This is a **Pro tier ($99/mo)** feature.

---

# PART I: ARCHITECTURE

## 1.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER DEVICES (ANYWHERE)                          │
│                                                                      │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐   │
│  │    Desktop    │  │    Laptop     │  │       Phone           │   │
│  │   (Browser)   │  │   (Browser)   │  │      (Browser)        │   │
│  └───────┬───────┘  └───────┬───────┘  └───────────┬───────────┘   │
│          │                  │                      │                │
│          └──────────────────┼──────────────────────┘                │
│                             │ HTTPS                                 │
│                             ▼                                       │
└─────────────────────────────┼───────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    HELIX OBSERVATORY (Cloud)                         │
│                    helix-project.org                                 │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    /code - Code Interface                     │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │   │
│  │  │   Panels    │  │   Voice     │  │   Session           │   │   │
│  │  │  (React)    │  │  (WebRTC)   │  │   Viewer            │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                        │
│                             │ WebSocket                              │
│                             ▼                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Relay Server                               │   │
│  │  • Authenticates user                                         │   │
│  │  • Routes to correct Helix instance                           │   │
│  │  • Proxies WebSocket connections                              │   │
│  │  • Handles WebRTC signaling for voice                         │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                             │                                        │
└─────────────────────────────┼────────────────────────────────────────┘
                              │
                              │ Tailscale / Direct
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    USER'S HELIX INSTANCE                             │
│                    (Their machine)                                   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                  OpenClaw Gateway                             │   │
│  │  • Accepts remote connections                                 │   │
│  │  • Authenticates via token                                    │   │
│  │  • Executes tools                                             │   │
│  │  • Streams results                                            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 1.2 Connection Methods

| Method                    | Setup  | Security         | Latency |
| ------------------------- | ------ | ---------------- | ------- |
| **Tailscale Funnel**      | Easy   | High (encrypted) | Low     |
| **Observatory Relay**     | None   | High (proxied)   | Medium  |
| **Direct (port forward)** | Manual | User-managed     | Lowest  |

### Tailscale Funnel (Recommended)

User enables Funnel on their Helix:

```yaml
gateway:
  tailscale:
    mode: funnel # Public HTTPS URL
```

Observatory connects directly via `https://helix-xxx.ts.net`

### Observatory Relay (Fallback)

For users who can't use Tailscale:

1. User's Helix establishes outbound WebSocket to Observatory
2. Observatory proxies user's browser to that WebSocket
3. No port forwarding required

```
Browser ──► Observatory ──► (reversed) ──► Helix Gateway
```

## 1.3 Component Locations

```
helix/web/
├── src/
│   ├── pages/
│   │   └── Code.tsx                    # Main code interface page
│   │
│   ├── components/
│   │   └── code/
│   │       ├── CodeInterface.tsx       # Main container
│   │       ├── panels/
│   │       │   ├── ThinkingPanel.tsx   # Claude's reasoning
│   │       │   ├── DiffPanel.tsx       # File edits
│   │       │   ├── TerminalPanel.tsx   # Bash output
│   │       │   └── OutputPanel.tsx     # Results/errors
│   │       ├── voice/
│   │       │   ├── VoiceButton.tsx     # WebRTC voice toggle
│   │       │   ├── VoiceIndicator.tsx  # Speaking/listening
│   │       │   ├── AudioVisualizer.tsx # Waveform
│   │       │   └── VoiceSettings.tsx   # Preferences
│   │       ├── input/
│   │       │   ├── ChatInput.tsx       # Text input
│   │       │   └── CommandPalette.tsx  # Quick actions
│   │       ├── status/
│   │       │   ├── StatusBar.tsx       # Connection, tokens, mode
│   │       │   ├── SessionInfo.tsx     # Current session
│   │       │   └── InstanceSelector.tsx # Switch instances
│   │       └── mobile/
│   │           ├── MobileLayout.tsx    # Responsive layout
│   │           ├── SwipePanels.tsx     # Panel navigation
│   │           └── MobileVoice.tsx     # Mobile voice UI
│   │
│   ├── lib/
│   │   ├── gateway-connection.ts       # WebSocket to Helix
│   │   ├── webrtc-voice.ts            # Voice over WebRTC
│   │   ├── stream-parser.ts           # Parse streaming output
│   │   └── session-manager.ts         # Session state
│   │
│   └── hooks/
│       ├── useGatewayConnection.ts
│       ├── useVoice.ts
│       ├── useStreaming.ts
│       └── usePanels.ts
│
└── supabase/
    └── functions/
        ├── relay-connect/              # WebSocket relay
        └── webrtc-signaling/           # Voice signaling
```

---

# PART II: CODE INTERFACE

## 2.1 Desktop Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  HELIX CODE                          🟢 Connected │ spectro-ts │ 47min │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─ THINKING ─────────────────────────────────────────────────────────┐ │
│  │                                                                     │ │
│  │  Looking at the Portfolio Manager component. I see the issue is    │ │
│  │  in how we're calculating the Sharpe ratio. The variance function  │ │
│  │  expects an array but we're passing a single value. Let me fix...  │ │
│  │                                                                     │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌─ CODE ─────────────────────────┐  ┌─ TERMINAL ────────────────────┐ │
│  │ 📝 src/utils/sharpe.ts         │  │ $ npm run test                 │ │
│  │                                │  │                                │ │
│  │  44   const calculateSharpe = │  │ > spectro@1.0.0 test           │ │
│  │  45 - const std = variance;    │  │ > vitest run                   │ │
│  │  45 + const std = variance(r); │  │                                │ │
│  │  46   return mean / std;       │  │ ✓ sharpe.test.ts (3 tests)    │ │
│  │                                │  │ ✓ portfolio.test.ts (7 tests) │ │
│  │                                │  │                                │ │
│  │ [Full Diff] [Copy]             │  │ All tests passed!             │ │
│  └────────────────────────────────┘  └────────────────────────────────┘ │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐  🎤  ⚙️   │
│  │ Fix the risk calculation next, then add more tests...   │  [Send]  │
│  └─────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2.2 Mobile Layout

```
┌─────────────────────────────┐
│ HELIX        🟢 │ 🎤 │ ⚙️  │
├─────────────────────────────┤
│  [Think] [Code] [Term] [Chat]│  ← Tab bar
├─────────────────────────────┤
│                             │
│  Looking at the Portfolio   │
│  Manager component. I see   │
│  the issue is in how we're  │
│  calculating the Sharpe     │
│  ratio. The variance        │
│  function expects an array  │
│  but we're passing a single │
│  value. Let me fix this...  │
│                             │
│  ┌───────────────────────┐  │
│  │ 📝 src/utils/sharpe.ts│  │
│  │ -const std = variance;│  │
│  │ +const std = var(r);  │  │
│  └───────────────────────┘  │
│                             │
├─────────────────────────────┤
│ ┌─────────────────────────┐ │
│ │ Message Helix...        │ │
│ └─────────────────────────┘ │
│        [🎤 Voice]           │
└─────────────────────────────┘

Swipe left/right to change panels
Tap 🎤 for push-to-talk
```

## 2.3 Panel Components

### ThinkingPanel

```typescript
interface ThinkingPanelProps {
  stream: ReadableStream<string>; // Claude's reasoning
  isThinking: boolean;
  onInterrupt: () => void;
}

// Features:
// - Character-by-character streaming
// - Thinking indicator (●●●) when waiting
// - Scroll lock when user scrolls up
// - Copy button
// - Expandable/collapsible
```

### DiffPanel

```typescript
interface DiffPanelProps {
  edits: FileEdit[];
  activeEdit: number;
  onSelectEdit: (index: number) => void;
}

interface FileEdit {
  filePath: string;
  language: string;
  oldContent: string;
  newContent: string;
  timestamp: Date;
}

// Features:
// - Tabbed if multiple files edited
// - Unified or split view toggle
// - Syntax highlighting
// - Line numbers with +/- indicators
// - "Open in GitHub" link
// - Copy old/new content
```

### TerminalPanel

```typescript
interface TerminalPanelProps {
  commands: CommandExecution[];
  activeCommand: number;
}

interface CommandExecution {
  id: string;
  command: string;
  workdir: string;
  stdout: string;
  stderr: string;
  status: 'running' | 'success' | 'error';
  exitCode?: number;
  startTime: Date;
  endTime?: Date;
}

// Features:
// - Live streaming output
// - ANSI color support
// - Scrollback buffer
// - Command history (tabbed)
// - Stop button for running commands
// - Copy output
```

### ChatInput

```typescript
interface ChatInputProps {
  onSend: (message: string) => void;
  onVoice: () => void;
  isVoiceActive: boolean;
  placeholder: string;
}

// Features:
// - Multi-line input (Shift+Enter)
// - Enter to send
// - Voice button integration
// - Command suggestions (/)
// - File attachment (drag & drop)
// - History (up/down arrows)
```

---

# PART III: VOICE OVER WEBRTC

## 3.1 Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│    Browser      │         │   Observatory   │         │  Helix Gateway  │
│                 │         │   (Signaling)   │         │                 │
└────────┬────────┘         └────────┬────────┘         └────────┬────────┘
         │                           │                           │
         │  1. Request voice         │                           │
         │ ─────────────────────────►│                           │
         │                           │                           │
         │                           │  2. Forward to Helix      │
         │                           │ ─────────────────────────►│
         │                           │                           │
         │                           │  3. Helix accepts         │
         │                           │ ◄─────────────────────────│
         │                           │                           │
         │  4. Exchange SDP offers   │                           │
         │ ◄────────────────────────►│◄─────────────────────────►│
         │                           │                           │
         │  5. ICE candidates        │                           │
         │ ◄────────────────────────►│◄─────────────────────────►│
         │                           │                           │
         │                                                       │
         │  6. Direct audio stream (peer-to-peer if possible)   │
         │ ◄────────────────────────────────────────────────────►│
         │                                                       │
```

## 3.2 WebRTC Implementation

```typescript
// helix/web/src/lib/webrtc-voice.ts

export class WebRTCVoice {
  private peerConnection: RTCPeerConnection;
  private localStream: MediaStream;
  private remoteStream: MediaStream;

  constructor(
    private signalingUrl: string,
    private instanceKey: string,
    private authToken: string
  ) {}

  async connect(): Promise<void> {
    // 1. Get user media (microphone)
    this.localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // 2. Create peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        // Add TURN servers for reliability
      ],
    });

    // 3. Add local tracks
    this.localStream.getTracks().forEach(track => {
      this.peerConnection.addTrack(track, this.localStream);
    });

    // 4. Handle remote tracks
    this.peerConnection.ontrack = event => {
      this.remoteStream = event.streams[0];
      this.emit('remote-audio', this.remoteStream);
    };

    // 5. Connect to signaling server
    await this.connectSignaling();
  }

  private async connectSignaling(): Promise<void> {
    const ws = new WebSocket(this.signalingUrl);

    ws.onopen = () => {
      ws.send(
        JSON.stringify({
          type: 'voice-connect',
          instanceKey: this.instanceKey,
          authToken: this.authToken,
        })
      );
    };

    ws.onmessage = async event => {
      const message = JSON.parse(event.data);

      switch (message.type) {
        case 'offer':
          await this.handleOffer(message.sdp);
          break;
        case 'answer':
          await this.handleAnswer(message.sdp);
          break;
        case 'ice-candidate':
          await this.handleIceCandidate(message.candidate);
          break;
      }
    };
  }

  // Push-to-talk
  mute(): void {
    this.localStream.getAudioTracks().forEach(t => (t.enabled = false));
  }

  unmute(): void {
    this.localStream.getAudioTracks().forEach(t => (t.enabled = true));
  }

  disconnect(): void {
    this.localStream?.getTracks().forEach(t => t.stop());
    this.peerConnection?.close();
  }
}
```

## 3.3 Helix Gateway Voice Handler

```typescript
// helix/helix-runtime/src/helix/voice/webrtc-server.ts

export class WebRTCServer {
  private peerConnection: RTCPeerConnection;

  constructor(
    private sttEngine: SpeechToText,
    private ttsEngine: TextToSpeech,
    private gateway: Gateway
  ) {}

  async handleVoiceConnection(
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> {
    // 1. Create peer connection
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });

    // 2. Handle incoming audio
    this.peerConnection.ontrack = async event => {
      const audioStream = event.streams[0];

      // Route to STT
      this.sttEngine.processStream(audioStream, async transcript => {
        // Process as chat message
        const response = await this.gateway.processMessage(transcript);

        // Generate speech response
        const audioResponse = await this.ttsEngine.synthesize(response);

        // Send back via WebRTC
        this.sendAudio(audioResponse);
      });
    };

    // 3. Add local audio track for TTS output
    const outputTrack = this.createAudioOutputTrack();
    this.peerConnection.addTrack(outputTrack);

    // 4. Set remote description and create answer
    await this.peerConnection.setRemoteDescription(offer);
    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    return answer;
  }

  private sendAudio(audioBuffer: ArrayBuffer): void {
    // Stream audio buffer to the remote peer
    // Implementation depends on how TTS output is formatted
  }
}
```

## 3.4 Voice UI Components

### VoiceButton

```typescript
// helix/web/src/components/code/voice/VoiceButton.tsx

interface VoiceButtonProps {
  isConnected: boolean;
  isActive: boolean;
  isSpeaking: boolean;
  isListening: boolean;
  mode: 'push-to-talk' | 'toggle' | 'always-on';
  onToggle: () => void;
  onPushStart: () => void;
  onPushEnd: () => void;
}

export function VoiceButton(props: VoiceButtonProps) {
  // Visual states:
  // - Disconnected: Gray mic icon
  // - Connected/Idle: White mic icon
  // - Listening: Green pulsing mic
  // - Speaking: Purple waveform animation
  // Interactions:
  // - Click (toggle mode): Toggle listening on/off
  // - Press & hold (PTT mode): Listen while held
  // - Long press: Open voice settings
}
```

### AudioVisualizer

```typescript
// helix/web/src/components/code/voice/AudioVisualizer.tsx

interface AudioVisualizerProps {
  stream: MediaStream | null;
  type: 'input' | 'output';
  style: 'waveform' | 'bars' | 'circle';
}

export function AudioVisualizer(props: AudioVisualizerProps) {
  // Uses Web Audio API AnalyserNode
  // - Input: Shows your voice levels
  // - Output: Shows Helix's voice levels
  // Styles:
  // - Waveform: Classic oscilloscope look
  // - Bars: Frequency bars (equalizer style)
  // - Circle: Pulsing circle (mobile-friendly)
}
```

---

# PART IV: SESSION SYNC & HANDOFF

## 4.1 Seamless Handoff

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SESSION CONTINUITY                            │
│                                                                      │
│  9:00 AM ──────────────────────────────────────────────────────────│
│  │ [Local - Voice] "Hey Helix, let's work on SpectroTS"             │
│  │                                                                   │
│  9:15 AM ──────────────────────────────────────────────────────────│
│  │ [Local - Voice] "Fix the Sharpe ratio calculation"               │
│  │  ├─ Helix edits src/utils/sharpe.ts                              │
│  │  └─ Runs tests, all pass                                         │
│  │                                                                   │
│  9:30 AM ──────────────────────────────────────────────────────────│
│  │ [Local - Keyboard] Continue refactoring...                       │
│  │                                                                   │
│  │       ┌─────────────────────────────────────────────────────┐    │
│  │       │  SESSION SYNC: Local → Supabase                     │    │
│  │       │  - 47 messages                                       │    │
│  │       │  - 12 tool calls                                     │    │
│  │       │  - 3 file edits                                      │    │
│  │       └─────────────────────────────────────────────────────┘    │
│  │                                                                   │
│  10:00 AM ─────────────────────────────────────────────────────────│
│  │ [Phone - Observatory] Open helix-project.org/code                │
│  │  └─ Session loads automatically (same conversation)              │
│  │                                                                   │
│  │ [Phone - Voice] "Helix, what's the status?"                      │
│  │  └─ "We've fixed the Sharpe calculation and tests pass.          │
│  │      Currently working on the risk metrics module."              │
│  │                                                                   │
│  10:05 AM ─────────────────────────────────────────────────────────│
│  │ [Phone - Voice] "Add unit tests for the variance function"       │
│  │  ├─ Helix creates src/utils/variance.test.ts                     │
│  │  └─ Runs tests                                                   │
│  │                                                                   │
│  │       ┌─────────────────────────────────────────────────────┐    │
│  │       │  SESSION SYNC: Observatory → Supabase → Local       │    │
│  │       │  - New messages synced                               │    │
│  │       │  - New tool calls synced                             │    │
│  │       │  - Files updated on local machine                    │    │
│  │       └─────────────────────────────────────────────────────┘    │
│  │                                                                   │
│  10:30 AM ─────────────────────────────────────────────────────────│
│  │ [Local - Back at desk] Continue in terminal...                   │
│  │  └─ All changes from phone session are present                   │
│  │                                                                   │
└─────────────────────────────────────────────────────────────────────┘
```

## 4.2 Sync Protocol

```typescript
// Session sync between Local ↔ Supabase ↔ Observatory

interface SessionSyncMessage {
  type: 'sync';
  sessionId: string;
  instanceKey: string;

  // Delta since last sync
  delta: {
    messages: Message[]; // Append-only
    toolCalls: ToolCall[]; // Append-only
    fileEdits: FileEdit[]; // Append-only

    // Current state (last-write-wins)
    state: {
      workingDirectory: string;
      openFiles: string[];
      mode: 'pair' | 'supervised' | 'autonomous';
    };
  };

  // Sync metadata
  localVersion: number;
  timestamp: Date;
}

// Sync flow:
// 1. Local makes change → Push delta to Supabase
// 2. Observatory subscribes to Supabase realtime
// 3. Observatory receives update instantly
// 4. Vice versa for Observatory → Local
```

## 4.3 Conflict Resolution

```typescript
// Conflicts are rare because:
// - Messages are append-only (no conflict possible)
// - Tool calls are append-only (no conflict possible)
// - State uses last-write-wins

interface ConflictResolution {
  // For state conflicts (both modified same field)
  strategy: 'latest-timestamp-wins';

  // Example:
  // Local: workingDirectory = '/project/src' at 10:00:00
  // Observatory: workingDirectory = '/project/tests' at 10:00:05
  // Result: '/project/tests' wins (later timestamp)
}

// Edge case: Both send at same millisecond
// Resolution: Observatory wins (tiebreaker)
```

---

# PART V: ACCESS CONTROL

## 5.1 Authentication Flow

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│   Browser   │     │   Observatory   │     │    Helix    │
│             │     │   (Supabase)    │     │   Gateway   │
└──────┬──────┘     └────────┬────────┘     └──────┬──────┘
       │                     │                     │
       │  1. Login           │                     │
       │ ───────────────────►│                     │
       │                     │                     │
       │  2. JWT token       │                     │
       │ ◄───────────────────│                     │
       │                     │                     │
       │  3. Request /code   │                     │
       │ ───────────────────►│                     │
       │                     │                     │
       │  4. Verify Pro tier │                     │
       │ ◄───────────────────│                     │
       │                     │                     │
       │  5. Get instance    │                     │
       │     connection info │                     │
       │ ◄───────────────────│                     │
       │                     │                     │
       │  6. Connect to Helix (with token)         │
       │ ─────────────────────────────────────────►│
       │                     │                     │
       │  7. Helix verifies token with Observatory │
       │                     │ ◄───────────────────│
       │                     │                     │
       │                     │  8. Confirmed       │
       │                     │ ───────────────────►│
       │                     │                     │
       │  9. WebSocket established                 │
       │ ◄─────────────────────────────────────────│
       │                     │                     │
```

## 5.2 Token Structure

```typescript
interface ObservatoryToken {
  // Standard JWT claims
  sub: string; // User ID
  iat: number; // Issued at
  exp: number; // Expires (1 hour)

  // Custom claims
  tier: 'free' | 'ghost' | 'observatory' | 'observatory_pro';
  instances: string[]; // Instance keys user owns
  permissions: {
    code: boolean; // Can access /code
    voice: boolean; // Can use voice
    api: boolean; // Can use research API
  };
}

// Token is passed to Helix Gateway
// Gateway verifies with Observatory before accepting connection
```

## 5.3 Instance Authorization

```typescript
// User can only connect to their own instances

// Supabase RLS policy:
// SELECT * FROM instances WHERE user_id = auth.uid()

// Connection flow:
// 1. User requests connection to instance X
// 2. Observatory checks: Does user own instance X?
// 3. If yes: Return connection info (Tailscale URL or relay)
// 4. If no: 403 Forbidden
```

---

# PART VI: MOBILE OPTIMIZATIONS

## 6.1 Responsive Design

```typescript
// Breakpoints
const breakpoints = {
  mobile: '640px', // < 640px: Single panel + tabs
  tablet: '1024px', // 640-1024px: Two panels
  desktop: '1024px+', // > 1024px: All panels
};

// Mobile layout
// - Tab bar at top for panel switching
// - Full-screen panels (one at a time)
// - Swipe gestures for navigation
// - Voice button always visible
// - Input bar at bottom (above keyboard)
```

## 6.2 Touch Interactions

```typescript
// Gesture handlers
const gestures = {
  swipeLeft: 'Next panel',
  swipeRight: 'Previous panel',
  pullDown: 'Refresh session',
  longPressVoice: 'Push-to-talk',
  doubleTapPanel: 'Fullscreen panel',
  pinchZoom: 'Zoom code/diff view',
};
```

## 6.3 Mobile Voice UX

```typescript
// Mobile voice is optimized for:
// - One-hand operation
// - Background audio (screen can be off)
// - Notification when Helix needs attention
// - Quick voice replies from notification

// Push notifications:
// "Helix: Tests failed. 3 errors in sharpe.test.ts"
// [Reply with voice] [Open app]
```

## 6.4 Offline Support

```typescript
// When offline:
// - Session history is cached
// - Can review past conversation
// - Cannot send new messages
// - Shows "Reconnecting..." indicator

// When back online:
// - Auto-reconnects
// - Syncs any local changes
// - Resumes session
```

---

# PART VII: IMPLEMENTATION PHASES

## Phase 1: Basic Code Interface (Week 1)

- [ ] /code page with tier gate
- [ ] WebSocket connection to Helix via Tailscale
- [ ] ThinkingPanel with streaming
- [ ] TerminalPanel with live output
- [ ] ChatInput
- [ ] StatusBar

## Phase 2: Diff & Polish (Week 2)

- [ ] DiffPanel with syntax highlighting
- [ ] Panel resizing and layout
- [ ] Mobile responsive layout
- [ ] Session display (messages, tool calls)

## Phase 3: Voice Integration (Week 3)

- [ ] WebRTC signaling server
- [ ] Browser microphone capture
- [ ] Audio streaming to Helix
- [ ] TTS playback in browser
- [ ] VoiceButton and indicators

## Phase 4: Session Sync (Week 4)

- [ ] Real-time sync via Supabase
- [ ] Handoff between local ↔ Observatory
- [ ] Conflict resolution
- [ ] Offline support

## Phase 5: Mobile & Polish (Week 5)

- [ ] Mobile layout optimization
- [ ] Touch gestures
- [ ] Push notifications
- [ ] PWA support (install to home screen)
- [ ] Performance optimization

---

# PART VIII: API ENDPOINTS

## 8.1 Observatory Code API

```yaml
# Base: https://api.helix-project.org/v1/code

# Connect to instance
POST /connect:
  headers:
    Authorization: Bearer <jwt>
  body:
    instanceKey: string
  response:
    connectionUrl: string # Tailscale URL or relay URL
    token: string # Short-lived connection token
    capabilities:
      voice: boolean
      streaming: boolean

# WebRTC signaling
POST /voice/offer:
  headers:
    Authorization: Bearer <jwt>
  body:
    instanceKey: string
    sdp: RTCSessionDescriptionInit
  response:
    sdp: RTCSessionDescriptionInit

POST /voice/ice:
  headers:
    Authorization: Bearer <jwt>
  body:
    instanceKey: string
    candidate: RTCIceCandidateInit

# Session sync (also available via Supabase Realtime)
GET /sessions/{sessionId}:
  response:
    session: Session

POST /sessions/{sessionId}/sync:
  body:
    delta: SessionDelta
  response:
    serverVersion: number
    merged: SessionDelta
```

---

**END OF OBSERVATORY CODE INTERFACE BLUEPRINT**

_"Your AI. Anywhere. Always listening."_

— Helix Observatory Code Interface v1.0
