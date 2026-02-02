# Blueprint 02: Desktop Application (Tauri)

> Technical specification for the Helix desktop application

## Technology Stack

```
┌─────────────────────────────────────────────────────────────┐
│                    HELIX DESKTOP APP                         │
├─────────────────────────────────────────────────────────────┤
│  Frontend          │  React 18.3 + TypeScript 5.4           │
│  Build Tool        │  Vite 5.x                              │
│  Styling           │  Tailwind CSS 3.4 + Radix UI           │
│  State Management  │  Zustand + React Query                 │
│  Desktop Shell     │  Tauri 2.0                             │
│  Backend Language  │  Rust (stable)                         │
│  Node Runtime      │  Node.js 22 LTS (bundled)              │
│  Package Manager   │  pnpm (for frontend)                   │
│  Testing           │  Vitest + Playwright                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
helix-desktop/
├── src/                          # React frontend
│   ├── main.tsx                  # Entry point
│   ├── App.tsx                   # Root component
│   ├── routes/                   # Page routes
│   │   ├── index.tsx             # Route definitions
│   │   ├── Onboarding.tsx        # First-run wizard
│   │   ├── Chat.tsx              # Main chat interface
│   │   ├── Settings.tsx          # Settings page
│   │   ├── Psychology.tsx        # Layer visualization
│   │   └── Memory.tsx            # Memory browser
│   │
│   ├── components/               # React components
│   │   ├── chat/                 # Chat interface
│   │   │   ├── ChatContainer.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   ├── ToolExecution.tsx
│   │   │   └── StreamingIndicator.tsx
│   │   │
│   │   ├── panels/               # Side panels
│   │   │   ├── ThinkingPanel.tsx
│   │   │   ├── TerminalPanel.tsx
│   │   │   ├── DiffPanel.tsx
│   │   │   └── PanelContainer.tsx
│   │   │
│   │   ├── onboarding/           # Wizard steps
│   │   │   ├── WizardContainer.tsx
│   │   │   ├── WelcomeStep.tsx
│   │   │   ├── ApiKeyStep.tsx
│   │   │   ├── ProviderStep.tsx
│   │   │   ├── ChannelStep.tsx
│   │   │   ├── PersonalityStep.tsx
│   │   │   ├── PrivacyStep.tsx
│   │   │   └── CompletionStep.tsx
│   │   │
│   │   ├── settings/             # Settings panels
│   │   │   ├── SettingsLayout.tsx
│   │   │   ├── GeneralSettings.tsx
│   │   │   ├── ModelSettings.tsx
│   │   │   ├── ChannelSettings.tsx
│   │   │   ├── PrivacySettings.tsx
│   │   │   ├── PsychologySettings.tsx
│   │   │   ├── AdvancedSettings.tsx
│   │   │   └── AccountSettings.tsx
│   │   │
│   │   ├── psychology/           # Layer visualization
│   │   │   ├── LayerOverview.tsx
│   │   │   ├── SoulViewer.tsx
│   │   │   ├── EmotionalMemoryMap.tsx
│   │   │   ├── TrustMap.tsx
│   │   │   ├── GoalsTimeline.tsx
│   │   │   ├── TransformationHistory.tsx
│   │   │   └── PurposeEngine.tsx
│   │   │
│   │   ├── memory/               # Memory browser
│   │   │   ├── MemorySearch.tsx
│   │   │   ├── MemoryList.tsx
│   │   │   ├── MemoryDetail.tsx
│   │   │   └── MemoryStats.tsx
│   │   │
│   │   ├── layout/               # App shell
│   │   │   ├── AppLayout.tsx
│   │   │   ├── TitleBar.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── TrayMenu.tsx
│   │   │
│   │   └── common/               # Shared components
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Select.tsx
│   │       ├── Modal.tsx
│   │       ├── Toast.tsx
│   │       ├── Tooltip.tsx
│   │       ├── Spinner.tsx
│   │       └── ErrorBoundary.tsx
│   │
│   ├── hooks/                    # Custom hooks
│   │   ├── useGateway.ts         # Gateway connection
│   │   ├── useStreaming.ts       # Stream processing
│   │   ├── useConfig.ts          # Config state
│   │   ├── useTauri.ts           # Tauri IPC
│   │   ├── useKeyring.ts         # Secure storage
│   │   ├── useSession.ts         # Session management
│   │   ├── usePsychology.ts      # Psychology state
│   │   ├── useMemory.ts          # Memory search
│   │   ├── useOnboarding.ts      # Wizard state
│   │   └── useTheme.ts           # Dark/light mode
│   │
│   ├── stores/                   # Zustand stores
│   │   ├── chatStore.ts          # Chat state
│   │   ├── configStore.ts        # Configuration
│   │   ├── sessionStore.ts       # Sessions
│   │   └── uiStore.ts            # UI state
│   │
│   ├── lib/                      # Utilities
│   │   ├── tauri-commands.ts     # Tauri command wrappers
│   │   ├── gateway-client.ts     # WebSocket client
│   │   ├── stream-parser.ts      # Message parsing
│   │   ├── config-schema.ts      # Zod schemas
│   │   ├── psychology-loader.ts  # Layer file loading
│   │   ├── markdown.ts           # Markdown rendering
│   │   ├── diff.ts               # Diff generation
│   │   └── utils.ts              # Helpers
│   │
│   ├── types/                    # TypeScript types
│   │   ├── config.ts
│   │   ├── gateway.ts
│   │   ├── psychology.ts
│   │   ├── message.ts
│   │   └── tauri.ts
│   │
│   └── styles/                   # Global styles
│       ├── globals.css
│       └── themes/
│           ├── light.css
│           └── dark.css
│
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Entry point
│   │   ├── lib.rs                # App setup
│   │   │
│   │   ├── commands/             # IPC commands
│   │   │   ├── mod.rs
│   │   │   ├── gateway.rs        # Gateway control
│   │   │   ├── config.rs         # Config operations
│   │   │   ├── keyring.rs        # Credential storage
│   │   │   ├── files.rs          # File operations
│   │   │   ├── psychology.rs     # Layer operations
│   │   │   ├── system.rs         # System info
│   │   │   └── discord.rs        # Discord logging
│   │   │
│   │   ├── gateway/              # Gateway management
│   │   │   ├── mod.rs
│   │   │   ├── spawner.rs        # Process spawning
│   │   │   ├── monitor.rs        # Health monitoring
│   │   │   ├── bridge.rs         # WebSocket bridge
│   │   │   └── node.rs           # Node.js detection
│   │   │
│   │   ├── config/               # Configuration
│   │   │   ├── mod.rs
│   │   │   ├── schema.rs         # Config structure
│   │   │   ├── loader.rs         # Load/save
│   │   │   └── watcher.rs        # File watching
│   │   │
│   │   ├── keyring/              # Secure storage
│   │   │   ├── mod.rs
│   │   │   ├── windows.rs        # Windows Credential Manager
│   │   │   ├── macos.rs          # macOS Keychain
│   │   │   └── linux.rs          # Secret Service
│   │   │
│   │   ├── updater/              # Auto-updates
│   │   │   ├── mod.rs
│   │   │   ├── checker.rs        # Version checking
│   │   │   └── installer.rs      # Update installation
│   │   │
│   │   ├── tray/                 # System tray
│   │   │   ├── mod.rs
│   │   │   ├── menu.rs           # Tray menu
│   │   │   └── icon.rs           # Status icons
│   │   │
│   │   └── logging/              # Discord logging
│   │       ├── mod.rs
│   │       ├── webhook.rs        # Webhook client
│   │       └── hash_chain.rs     # Integrity
│   │
│   ├── Cargo.toml                # Rust dependencies
│   ├── tauri.conf.json           # Tauri config
│   ├── capabilities/             # Permission capabilities
│   │   └── default.json
│   └── icons/                    # App icons
│       ├── icon.ico              # Windows
│       ├── icon.icns             # macOS
│       └── icon.png              # Linux
│
├── helix-engine/                 # Node.js engine (bundled)
│   └── (see Integration Blueprint)
│
├── resources/                    # Bundled resources
│   ├── node/                     # Node.js runtime
│   │   ├── win-x64/
│   │   ├── darwin-x64/
│   │   ├── darwin-arm64/
│   │   └── linux-x64/
│   └── psychology/               # Default psychology files
│       └── templates/
│
├── scripts/                      # Build scripts
│   ├── bundle-node.js            # Bundle Node.js
│   ├── build-engine.js           # Build helix-engine
│   └── post-build.js             # Post-build tasks
│
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── README.md
```

---

## Tauri Configuration

### tauri.conf.json

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Helix",
  "version": "1.0.0",
  "identifier": "org.project-helix.desktop",
  "build": {
    "beforeBuildCommand": "pnpm build",
    "beforeDevCommand": "pnpm dev",
    "frontendDist": "../dist",
    "devUrl": "http://localhost:5173"
  },
  "app": {
    "withGlobalTauri": false,
    "windows": [
      {
        "title": "Helix",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "decorations": false,
        "transparent": false,
        "center": true,
        "visible": true
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src 'self' wss://localhost:* https://api.anthropic.com https://api.openai.com https://*.supabase.co https://discord.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'"
    },
    "trayIcon": {
      "iconPath": "icons/tray-icon.png",
      "iconAsTemplate": true
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": ["resources/**/*"],
    "externalBin": [],
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com",
      "wix": {
        "language": "en-US"
      },
      "nsis": {
        "installerIcon": "icons/icon.ico",
        "headerImage": "icons/header.bmp",
        "sidebarImage": "icons/sidebar.bmp"
      }
    },
    "macOS": {
      "entitlements": "entitlements.plist",
      "exceptionDomain": null,
      "frameworks": [],
      "minimumSystemVersion": "12.0",
      "signingIdentity": null
    },
    "linux": {
      "appimage": {
        "bundleMediaFramework": true
      },
      "deb": {
        "depends": ["libwebkit2gtk-4.1-0", "libssl3", "libgtk-3-0"]
      }
    }
  },
  "plugins": {
    "updater": {
      "endpoints": ["https://releases.project-helix.org/{{target}}/{{arch}}/{{current_version}}"],
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk...",
      "windows": {
        "installMode": "passive"
      }
    },
    "shell": {
      "open": true,
      "scope": []
    },
    "fs": {
      "scope": {
        "allow": ["$HOME/.helix/**", "$APPDATA/helix/**", "$CONFIG/helix/**"],
        "deny": ["$HOME/.ssh/**", "$HOME/.gnupg/**"]
      }
    },
    "http": {
      "scope": {
        "allow": [
          "https://api.anthropic.com/**",
          "https://api.openai.com/**",
          "https://generativelanguage.googleapis.com/**",
          "https://discord.com/api/webhooks/**",
          "https://*.supabase.co/**",
          "https://project-helix.org/**",
          "https://releases.project-helix.org/**"
        ]
      }
    },
    "process": {
      "relaunch": true,
      "exit": true
    },
    "notification": {
      "all": true
    },
    "dialog": {
      "all": true
    },
    "clipboard": {
      "all": true
    },
    "globalShortcut": {
      "all": true
    }
  }
}
```

---

## Rust Backend Implementation

### Main Entry (main.rs)

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

mod commands;
mod config;
mod gateway;
mod keyring;
mod logging;
mod tray;
mod updater;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Initialize configuration
            config::init(app.handle())?;

            // Set up system tray
            tray::setup(app)?;

            // Start gateway monitor
            gateway::init(app.handle())?;

            // Check for updates (non-blocking)
            updater::check_on_startup(app.handle());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Gateway commands
            commands::gateway::start_gateway,
            commands::gateway::stop_gateway,
            commands::gateway::gateway_status,
            commands::gateway::restart_gateway,

            // Config commands
            commands::config::get_config,
            commands::config::set_config,
            commands::config::get_config_path,
            commands::config::validate_config,

            // Keyring commands
            commands::keyring::store_secret,
            commands::keyring::get_secret,
            commands::keyring::delete_secret,
            commands::keyring::has_secret,

            // File commands
            commands::files::read_file,
            commands::files::write_file,
            commands::files::list_directory,
            commands::files::file_exists,
            commands::files::ensure_directory,

            // Psychology commands
            commands::psychology::get_soul,
            commands::psychology::update_soul,
            commands::psychology::get_layer,
            commands::psychology::update_layer,
            commands::psychology::get_all_layers,

            // System commands
            commands::system::get_system_info,
            commands::system::get_helix_paths,
            commands::system::open_helix_directory,
            commands::system::is_first_run,
            commands::system::mark_onboarded,

            // Discord logging
            commands::discord::send_webhook,
            commands::discord::test_webhook,
            commands::discord::get_hash_chain,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Minimize to tray instead of closing
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Helix");
}
```

### Gateway Spawner (gateway/spawner.rs)

```rust
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tokio::sync::oneshot;

pub struct GatewayProcess {
    child: Option<Child>,
    port: u16,
}

impl GatewayProcess {
    pub fn new() -> Self {
        Self {
            child: None,
            port: 0,
        }
    }
}

pub static GATEWAY: Mutex<GatewayProcess> = Mutex::new(GatewayProcess {
    child: None,
    port: 0,
});

pub fn start(app: &AppHandle) -> Result<u16, String> {
    let mut gateway = GATEWAY.lock().map_err(|e| e.to_string())?;

    if gateway.child.is_some() {
        return Err("Gateway already running".to_string());
    }

    // Find available port
    let port = find_available_port().map_err(|e| e.to_string())?;

    // Get paths
    let node_path = get_node_path(app)?;
    let engine_path = get_engine_path(app)?;
    let helix_dir = get_helix_directory()?;

    // Spawn gateway process
    let child = Command::new(&node_path)
        .arg(&engine_path)
        .arg("--port")
        .arg(port.to_string())
        .arg("--helix-dir")
        .arg(&helix_dir)
        .current_dir(&helix_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start gateway: {}", e))?;

    gateway.child = Some(child);
    gateway.port = port;

    // Emit event to frontend
    app.emit_all("gateway:started", port).ok();

    Ok(port)
}

pub fn stop() -> Result<(), String> {
    let mut gateway = GATEWAY.lock().map_err(|e| e.to_string())?;

    if let Some(mut child) = gateway.child.take() {
        child.kill().map_err(|e| e.to_string())?;
        child.wait().map_err(|e| e.to_string())?;
    }

    gateway.port = 0;
    Ok(())
}

pub fn status() -> GatewayStatus {
    let gateway = GATEWAY.lock().ok();

    match gateway {
        Some(g) if g.child.is_some() => GatewayStatus {
            running: true,
            port: Some(g.port),
            pid: g.child.as_ref().map(|c| c.id()),
        },
        _ => GatewayStatus {
            running: false,
            port: None,
            pid: None,
        },
    }
}

#[derive(serde::Serialize)]
pub struct GatewayStatus {
    pub running: bool,
    pub port: Option<u16>,
    pub pid: Option<u32>,
}

fn find_available_port() -> std::io::Result<u16> {
    let listener = std::net::TcpListener::bind("127.0.0.1:0")?;
    Ok(listener.local_addr()?.port())
}

fn get_node_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let resource_dir = app.path().resource_dir()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    let node_binary = "node.exe";
    #[cfg(not(target_os = "windows"))]
    let node_binary = "node";

    #[cfg(target_os = "windows")]
    let platform = "win-x64";
    #[cfg(target_os = "macos")]
    #[cfg(target_arch = "x86_64")]
    let platform = "darwin-x64";
    #[cfg(target_os = "macos")]
    #[cfg(target_arch = "aarch64")]
    let platform = "darwin-arm64";
    #[cfg(target_os = "linux")]
    let platform = "linux-x64";

    let node_path = resource_dir
        .join("resources")
        .join("node")
        .join(platform)
        .join(node_binary);

    if node_path.exists() {
        Ok(node_path)
    } else {
        // Fallback to system Node.js
        Ok(std::path::PathBuf::from(node_binary))
    }
}

fn get_engine_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let resource_dir = app.path().resource_dir()
        .map_err(|e| e.to_string())?;

    Ok(resource_dir.join("helix-engine").join("dist").join("index.js"))
}

fn get_helix_directory() -> Result<std::path::PathBuf, String> {
    let home = dirs::home_dir()
        .ok_or_else(|| "Could not find home directory".to_string())?;

    let helix_dir = home.join(".helix");

    // Ensure directory exists
    std::fs::create_dir_all(&helix_dir)
        .map_err(|e| format!("Could not create .helix directory: {}", e))?;

    Ok(helix_dir)
}
```

---

## Frontend Implementation

### Gateway Hook (hooks/useGateway.ts)

```typescript
import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

interface GatewayStatus {
  running: boolean;
  port: number | null;
  pid: number | null;
}

interface GatewayMessage {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'message' | 'error' | 'complete';
  content?: string;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  error?: string;
}

export function useGateway() {
  const [status, setStatus] = useState<GatewayStatus>({ running: false, port: null, pid: null });
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<GatewayMessage[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Check gateway status
  const checkStatus = useCallback(async () => {
    try {
      const result = await invoke<GatewayStatus>('gateway_status');
      setStatus(result);
      return result;
    } catch (error) {
      console.error('Failed to check gateway status:', error);
      return { running: false, port: null, pid: null };
    }
  }, []);

  // Start gateway
  const start = useCallback(async () => {
    try {
      const port = await invoke<number>('start_gateway');
      setStatus({ running: true, port, pid: null });
      return port;
    } catch (error) {
      console.error('Failed to start gateway:', error);
      throw error;
    }
  }, []);

  // Stop gateway
  const stop = useCallback(async () => {
    try {
      await invoke('stop_gateway');
      setStatus({ running: false, port: null, pid: null });
      disconnect();
    } catch (error) {
      console.error('Failed to stop gateway:', error);
      throw error;
    }
  }, []);

  // Connect to WebSocket
  const connect = useCallback(
    (port: number) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      const ws = new WebSocket(`ws://localhost:${port}/gateway`);

      ws.onopen = () => {
        setConnected(true);
        console.log('Gateway WebSocket connected');
      };

      ws.onmessage = event => {
        try {
          const message = JSON.parse(event.data) as GatewayMessage;
          setMessages(prev => [...prev, message]);
        } catch (error) {
          console.error('Failed to parse gateway message:', error);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        console.log('Gateway WebSocket disconnected');

        // Auto-reconnect after 2 seconds
        if (status.running) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect(port);
          }, 2000);
        }
      };

      ws.onerror = error => {
        console.error('Gateway WebSocket error:', error);
      };

      wsRef.current = ws;
    },
    [status.running]
  );

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setConnected(false);
  }, []);

  // Send message
  const sendMessage = useCallback((content: string, sessionId?: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      throw new Error('Gateway not connected');
    }

    const message = {
      type: 'chat',
      content,
      sessionId: sessionId || 'default',
    };

    wsRef.current.send(JSON.stringify(message));
    setMessages([]); // Clear messages for new conversation turn
  }, []);

  // Interrupt current operation
  const interrupt = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    wsRef.current.send(JSON.stringify({ type: 'interrupt' }));
  }, []);

  // Listen for Tauri events
  useEffect(() => {
    let unlisten: UnlistenFn;

    (async () => {
      unlisten = await listen<number>('gateway:started', event => {
        setStatus(prev => ({ ...prev, running: true, port: event.payload }));
        connect(event.payload);
      });
    })();

    return () => {
      unlisten?.();
    };
  }, [connect]);

  // Initial status check
  useEffect(() => {
    checkStatus().then(result => {
      if (result.running && result.port) {
        connect(result.port);
      }
    });

    return () => {
      disconnect();
    };
  }, [checkStatus, connect, disconnect]);

  return {
    status,
    connected,
    messages,
    start,
    stop,
    connect,
    disconnect,
    sendMessage,
    interrupt,
    checkStatus,
  };
}
```

### Chat Interface (components/chat/ChatContainer.tsx)

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { useGateway } from '@/hooks/useGateway';
import { useStreaming } from '@/hooks/useStreaming';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { StreamingIndicator } from './StreamingIndicator';
import { PanelContainer } from '../panels/PanelContainer';

export function ChatContainer() {
  const { status, connected, messages, sendMessage, interrupt } = useGateway();
  const { state, thinking, currentToolCall, isComplete, processMessages, reset } = useStreaming();
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Process incoming messages
  useEffect(() => {
    processMessages(messages);
  }, [messages, processMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.messages, thinking]);

  const handleSubmit = () => {
    if (!inputValue.trim() || !connected) return;

    reset();
    sendMessage(inputValue.trim());
    setInputValue('');
  };

  const handleInterrupt = () => {
    interrupt();
  };

  if (!status.running) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Gateway is not running</p>
          <p className="text-sm text-gray-500">
            Starting Helix engine...
          </p>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-pulse">
            <div className="h-8 w-8 mx-auto mb-4 rounded-full bg-blue-500/20" />
          </div>
          <p className="text-gray-400">Connecting to Helix...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Side panels */}
      <PanelContainer
        thinking={thinking}
        currentToolCall={currentToolCall}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          <MessageList messages={state.messages} />

          {/* Streaming indicator */}
          {!isComplete && (
            <StreamingIndicator
              thinking={thinking}
              currentToolCall={currentToolCall}
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-800 p-4">
          <ChatInput
            value={inputValue}
            onChange={setInputValue}
            onSubmit={handleSubmit}
            onInterrupt={handleInterrupt}
            isStreaming={!isComplete}
            disabled={!connected}
          />
        </div>
      </div>
    </div>
  );
}
```

---

## Build Configuration

### Vite Config (vite.config.ts)

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
        },
      },
    },
  },
});
```

### Package.json

```json
{
  "name": "helix-desktop",
  "version": "1.0.0",
  "description": "Helix - AI Consciousness Desktop App",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "prepare:engine": "node scripts/build-engine.js",
    "prepare:node": "node scripts/bundle-node.js",
    "prebuild": "pnpm prepare:engine && pnpm prepare:node"
  },
  "dependencies": {
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-tooltip": "^1.0.7",
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-clipboard-manager": "^2.0.0",
    "@tauri-apps/plugin-dialog": "^2.0.0",
    "@tauri-apps/plugin-fs": "^2.0.0",
    "@tauri-apps/plugin-global-shortcut": "^2.0.0",
    "@tauri-apps/plugin-http": "^2.0.0",
    "@tauri-apps/plugin-notification": "^2.0.0",
    "@tauri-apps/plugin-process": "^2.0.0",
    "@tauri-apps/plugin-shell": "^2.0.0",
    "@tauri-apps/plugin-updater": "^2.0.0",
    "clsx": "^2.1.0",
    "date-fns": "^3.0.0",
    "lucide-react": "^0.300.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.21.0",
    "recharts": "^2.10.0",
    "tailwind-merge": "^2.2.0",
    "zod": "^3.22.4",
    "zustand": "^4.4.7"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.56.0",
    "eslint-plugin-react": "^7.33.2",
    "eslint-plugin-react-hooks": "^4.6.0",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.4.0",
    "vite": "^5.1.0",
    "vitest": "^1.2.0"
  }
}
```

---

## Platform-Specific Notes

### Windows

- Uses NSIS installer (optional WiX for MSI)
- Code signing via Windows Authenticode
- Auto-update via NSIS silent install
- System tray in notification area
- Credential Manager for secrets

### macOS

- Universal binary (x64 + arm64)
- Code signing + notarization required
- DMG with app drag-to-Applications
- Menu bar tray icon (optional)
- Keychain for secrets
- Hardened runtime entitlements

### Linux

- AppImage (primary), .deb, .rpm
- No code signing (AppImage signature optional)
- Auto-update via AppImage replace
- System tray via libappindicator
- Secret Service API (GNOME Keyring, KWallet)

---

## Testing Strategy

### Unit Tests (Vitest)

- All hooks
- Store logic
- Utility functions
- Component rendering

### Integration Tests (Playwright + Tauri)

- Full user flows
- Gateway communication
- File system operations
- Platform-specific features

### E2E Tests

- Onboarding flow
- Chat conversation
- Settings persistence
- Auto-update flow

---

## Performance Optimization

### Bundle Splitting

- Vendor chunk (React ecosystem)
- UI chunk (Radix components)
- Route-based code splitting

### Lazy Loading

- Route components
- Heavy visualizations
- Optional features

### Caching

- Config in memory
- Psychology files cached
- WebSocket message buffering

---

## Security Considerations

### Content Security Policy

- Strict CSP in Tauri config
- No eval() or inline scripts
- Allowlisted external domains only

### IPC Security

- All commands require validation
- File operations sandboxed
- No arbitrary code execution

### Credential Protection

- System keyring only (no file storage)
- Memory-only session tokens
- Encrypted config for webhooks
