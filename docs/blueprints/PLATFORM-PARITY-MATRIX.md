# Helix Platform Parity Matrix

> Every OpenClaw step mapped to Desktop, Web, and Mobile

---

## Legend

| Symbol | Meaning                         |
| ------ | ------------------------------- |
| ✅     | Fully supported, frictionless   |
| 🔧     | Supported with simplification   |
| ⚡     | Supported via bridge to Desktop |
| ❌     | Not possible on platform        |
| 🔮     | Future feature                  |

---

# 1. GETTING STARTED (getting-started.md)

## 1.1 System Requirements

| OpenClaw Requirement | Desktop                 | Web                     | Mobile                  | Notes                |
| -------------------- | ----------------------- | ----------------------- | ----------------------- | -------------------- |
| Node.js ≥22          | ✅ Bundled              | ✅ Server-side          | ✅ N/A                  | User never sees Node |
| pnpm                 | ✅ Bundled              | ✅ N/A                  | ✅ N/A                  | Internal only        |
| macOS: Xcode/CLT     | ✅ Not needed           | ✅ N/A                  | ✅ N/A                  | Tauri pre-built      |
| Windows: WSL2        | ✅ Native Windows       | ✅ N/A                  | ✅ N/A                  | Tauri = native       |
| Brave Search API     | 🔧 Optional in settings | 🔧 Optional in settings | 🔧 Optional in settings | Nice-to-have         |

**Friction eliminated:** All prerequisites bundled or eliminated.

---

## 1.2 Installation Methods

| OpenClaw Method      | Desktop                         | Web               | Mobile                | Notes      |
| -------------------- | ------------------------------- | ----------------- | --------------------- | ---------- |
| curl installer       | ✅ Download .exe/.dmg/.AppImage | ✅ Just visit URL | ✅ PWA install prompt | One-click  |
| PowerShell installer | ✅ Download .exe                | ✅ Just visit URL | ✅ PWA install prompt | One-click  |
| npm/pnpm install     | ✅ Not needed                   | ✅ Not needed     | ✅ Not needed         | Eliminated |

**Friction eliminated:** No terminal commands to install.

---

## 1.3 Onboarding Wizard Trigger

| OpenClaw Command                    | Desktop                 | Web                    | Mobile                 | Notes              |
| ----------------------------------- | ----------------------- | ---------------------- | ---------------------- | ------------------ |
| `openclaw onboard`                  | ✅ Auto on first launch | ✅ Auto on first visit | ✅ Auto on first visit | Visual wizard      |
| `openclaw onboard --install-daemon` | ✅ Auto-managed         | ✅ N/A                 | ✅ N/A                 | Background service |
| `openclaw configure`                | ✅ Settings panel       | ✅ Settings panel      | ✅ Settings panel      | GUI always         |

**Friction eliminated:** No terminal, auto-triggered.

---

## 1.4 Authentication Storage

| OpenClaw Location                            | Desktop            | Web             | Mobile            | Notes       |
| -------------------------------------------- | ------------------ | --------------- | ----------------- | ----------- |
| `~/.openclaw/credentials/oauth.json`         | ✅ System keychain | ✅ Encrypted DB | ✅ Secure storage | More secure |
| `~/.openclaw/agents/<id>/auth-profiles.json` | ✅ Internal        | ✅ Cloud DB     | ⚡ Via Desktop    | Managed     |

**Friction eliminated:** Secure by default, no file management.

---

## 1.5 Gateway Operations

| OpenClaw Command                          | Desktop            | Web              | Mobile           | Notes       |
| ----------------------------------------- | ------------------ | ---------------- | ---------------- | ----------- |
| `openclaw gateway --port 18789 --verbose` | ✅ Auto-start      | ✅ Cloud gateway | ⚡ Cloud gateway | No terminal |
| Dashboard at `http://127.0.0.1:18789/`    | ✅ Built into app  | ✅ Is the app    | ✅ Is the app    | Native UI   |
| Bun incompatibility warning               | ✅ N/A (uses Node) | ✅ N/A           | ✅ N/A           | Non-issue   |

**Friction eliminated:** Gateway is invisible to user.

---

## 1.6 Channel Connection

| OpenClaw Method                         | Desktop                           | Web             | Mobile          | Notes                  |
| --------------------------------------- | --------------------------------- | --------------- | --------------- | ---------------------- |
| `openclaw channels login` (WhatsApp QR) | ✅ "Connect WhatsApp" button → QR | ❌ Needs local  | ⚡ Via Desktop  | QR scan same           |
| Telegram bot token                      | 🔧 Guided setup with links        | 🔧 Guided setup | 🔧 Guided setup | Still needs @BotFather |
| Discord bot token                       | 🔧 Guided setup with links        | 🔧 Guided setup | 🔧 Guided setup | Still needs Dev Portal |

**Friction reduced:** Guided flows instead of raw commands.

---

## 1.7 Security (Pairing)

| OpenClaw Command           | Desktop                          | Web                              | Mobile                         | Notes   |
| -------------------------- | -------------------------------- | -------------------------------- | ------------------------------ | ------- |
| `openclaw pairing approve` | ✅ Notification → Approve button | ⚡ Notification → Approve button | ✅ Push notification → Approve | One-tap |

**Friction eliminated:** No terminal for approvals.

---

## 1.8 Development Workflow

| OpenClaw Step    | Desktop          | Web              | Mobile           | Notes    |
| ---------------- | ---------------- | ---------------- | ---------------- | -------- |
| Clone repository | ❌ Not for users | ❌ Not for users | ❌ Not for users | Dev only |
| `pnpm install`   | ❌ Not for users | ❌ Not for users | ❌ Not for users | Dev only |
| `pnpm build`     | ❌ Not for users | ❌ Not for users | ❌ Not for users | Dev only |

**Friction eliminated:** Users don't build from source.

---

# 2. WIZARD (wizard.md)

## 2.1 Entry Commands

| OpenClaw Command     | Desktop                       | Web                             | Mobile            | Notes      |
| -------------------- | ----------------------------- | ------------------------------- | ----------------- | ---------- |
| `openclaw onboard`   | ✅ Visual wizard on first run | ✅ Visual wizard on first visit | ✅ Visual wizard  | Auto       |
| `openclaw configure` | ✅ Settings panel anytime     | ✅ Settings panel               | ✅ Settings panel | Always GUI |
| `openclaw dashboard` | ✅ Main view IS dashboard     | ✅ Main view IS dashboard       | ✅ Main view      | Default    |

---

## 2.2 QuickStart vs Advanced Modes

| OpenClaw Mode                | Desktop                  | Web                      | Mobile         | Notes       |
| ---------------------------- | ------------------------ | ------------------------ | -------------- | ----------- |
| QuickStart (preset defaults) | ✅ "Quick Setup" button  | ✅ Default path          | ✅ Only option | Recommended |
| Advanced (granular control)  | ✅ "Advanced" expandable | ✅ "Advanced" expandable | 🔮 Future      | Power users |

---

## 2.3 Nine-Step Wizard

| Step                         | OpenClaw                    | Desktop                       | Web                             | Mobile             |
| ---------------------------- | --------------------------- | ----------------------------- | ------------------------------- | ------------------ |
| 1. Existing config detection | Prompt: Keep/Modify/Reset   | ✅ Auto-detect, offer reset   | ✅ Cloud-based, no conflict     | ✅ Cloud-based     |
| 2. Model/Auth selection      | Multi-provider choice       | ✅ Visual cards for providers | ✅ Same UI                      | ✅ Same UI         |
| 3. Workspace configuration   | Set directory path          | ✅ Auto `~/.helix/`           | ✅ Cloud storage                | ✅ Cloud storage   |
| 4. Gateway settings          | Port, bind, auth, Tailscale | ✅ Auto-configured            | ✅ Cloud gateway                | ✅ Cloud gateway   |
| 5. Channel providers         | Multi-select                | ✅ Channel cards              | ❌ WhatsApp/Telegram local only | ⚡ Via Desktop     |
| 6. Daemon installation       | LaunchAgent/systemd         | ✅ Auto background service    | ✅ N/A (server)                 | ✅ N/A             |
| 7. Health verification       | Diagnostics                 | ✅ Visual health check        | ✅ Connection test              | ✅ Connection test |
| 8. Skills setup              | Node manager, deps          | ✅ Skill browser              | ✅ Skill browser                | ✅ Skill browser   |
| 9. Completion summary        | Next steps                  | ✅ "You're ready!" screen     | ✅ Same                         | ✅ Same            |

**Friction reduced:** 9 steps → 4-5 visual steps max.

---

## 2.4 Remote Mode

| OpenClaw Feature          | Desktop                      | Web                | Mobile             | Notes                              |
| ------------------------- | ---------------------------- | ------------------ | ------------------ | ---------------------------------- |
| Connect to remote gateway | ✅ Settings → Remote Gateway | ✅ Default (cloud) | ✅ Default (cloud) | Web/Mobile are inherently "remote" |
| WebSocket URL config      | ✅ URL input field           | ✅ Auto cloud URL  | ✅ Auto cloud URL  | Simplified                         |
| Auth token config         | ✅ Token field               | ✅ Session cookie  | ✅ Session token   | Handled                            |

---

## 2.5 Non-Interactive Automation

| OpenClaw Feature          | Desktop                    | Web                   | Mobile | Notes       |
| ------------------------- | -------------------------- | --------------------- | ------ | ----------- |
| `--non-interactive` flag  | ✅ Config import file      | ✅ API for automation | ❌ N/A | Power users |
| `--anthropic-api-key` etc | ✅ Env vars or config file | ✅ API params         | ❌ N/A | Scripting   |
| `--json` output           | ✅ Logs export             | ✅ API responses      | ❌ N/A | Dev/CI use  |

---

## 2.6 Multiple Agents

| OpenClaw Command             | Desktop               | Web                   | Mobile             | Notes     |
| ---------------------------- | --------------------- | --------------------- | ------------------ | --------- |
| `openclaw agents add <name>` | ✅ "New Agent" button | ✅ "New Agent" button | 🔮 Future          | Visual    |
| Separate workspaces          | ✅ Automatic          | ✅ Cloud-separated    | ✅ Cloud-separated | Invisible |
| Agent switching              | ✅ Sidebar list       | ✅ Sidebar list       | ✅ Tab/drawer      | Easy      |

---

## 2.7 Configuration Storage

| OpenClaw Location                   | Desktop                  | Web             | Mobile            | Notes           |
| ----------------------------------- | ------------------------ | --------------- | ----------------- | --------------- |
| `~/.openclaw/openclaw.json`         | ✅ Internal, GUI exposes | ✅ Cloud DB     | ✅ Cloud DB       | No JSON editing |
| `~/.openclaw/credentials/`          | ✅ System keychain       | ✅ Encrypted DB | ✅ Secure storage | More secure     |
| `~/.openclaw/agents/<id>/sessions/` | ✅ Local SQLite          | ✅ Cloud DB     | ✅ Cloud DB       | Synced          |

---

# 3. SETUP (setup.md)

## 3.1 Key Locations

| OpenClaw Path                       | Desktop                        | Web              | Mobile           | Notes                |
| ----------------------------------- | ------------------------------ | ---------------- | ---------------- | -------------------- |
| `~/.openclaw/workspace`             | ✅ `~/.helix/workspace` (auto) | ✅ Cloud storage | ✅ Cloud storage | User never navigates |
| `~/.openclaw/openclaw.json`         | ✅ Internal                    | ✅ Cloud         | ✅ Cloud         | GUI only             |
| `~/.openclaw/credentials/`          | ✅ System keychain             | ✅ Encrypted     | ✅ Secure        | Better security      |
| `~/.openclaw/agents/<id>/sessions/` | ✅ Internal                    | ✅ Cloud         | ✅ Cloud         | Synced               |
| `/tmp/openclaw/` logs               | ✅ Log viewer in app           | ✅ Log viewer    | ✅ Minimal logs  | In-app access        |

---

## 3.2 Setup Commands

| OpenClaw Command          | Desktop                         | Web                   | Mobile               | Notes          |
| ------------------------- | ------------------------------- | --------------------- | -------------------- | -------------- |
| `openclaw setup`          | ✅ Onboarding wizard            | ✅ Onboarding wizard  | ✅ Onboarding wizard | Visual         |
| `openclaw health`         | ✅ System Health panel          | ✅ Connection status  | ✅ Status indicator  | Always visible |
| `openclaw channels login` | ✅ "Connect" button per channel | ❌ Local channels N/A | ⚡ Via Desktop       | Button         |

---

## 3.3 Two Primary Workflows

| OpenClaw Workflow   | Desktop            | Web              | Mobile     | Notes    |
| ------------------- | ------------------ | ---------------- | ---------- | -------- |
| Stable (macOS app)  | ✅ Our app IS this | ✅ Cloud version | ✅ PWA/App | Default  |
| Bleeding edge (dev) | ✅ Dev mode toggle | ❌ N/A for users | ❌ N/A     | Internal |

---

## 3.4 Credential Storage

| OpenClaw Credential | Desktop            | Web                  | Mobile            | Notes      |
| ------------------- | ------------------ | -------------------- | ----------------- | ---------- |
| WhatsApp creds.json | ✅ Encrypted local | ❌ N/A               | ⚡ Desktop bridge | Local only |
| Telegram token      | ✅ System keychain | ✅ Cloud (encrypted) | ✅ Cloud          | Synced     |
| Discord token       | ✅ System keychain | ✅ Cloud (encrypted) | ✅ Cloud          | Synced     |
| OAuth tokens        | ✅ System keychain | ✅ Cloud (encrypted) | ✅ Cloud          | Synced     |

---

## 3.5 Linux Notes

| OpenClaw Requirement          | Desktop                    | Web    | Mobile | Notes  |
| ----------------------------- | -------------------------- | ------ | ------ | ------ |
| `sudo loginctl enable-linger` | ✅ Auto-prompted if needed | ✅ N/A | ✅ N/A | Guided |

---

## 3.6 Update Strategy

| OpenClaw Method                 | Desktop               | Web              | Mobile      | Notes       |
| ------------------------------- | --------------------- | ---------------- | ----------- | ----------- |
| `git pull` updates              | ✅ Auto-update        | ✅ Always latest | ✅ PWA auto | Zero effort |
| Keep customization outside repo | ✅ User data separate | ✅ Cloud DB      | ✅ Cloud DB | Safe        |

---

# 4. PAIRING (pairing.md)

## 4.1 DM Pairing (Chat Access Control)

| OpenClaw Feature     | Desktop                       | Web                      | Mobile               | Notes   |
| -------------------- | ----------------------------- | ------------------------ | -------------------- | ------- |
| Pairing policy mode  | ✅ Toggle in channel settings | ✅ Toggle in settings    | ✅ Toggle            | Visual  |
| 8-char pairing codes | ✅ Shown in notification      | ✅ Shown in notification | ✅ Push notification | Same    |
| 1-hour expiration    | ✅ Countdown shown            | ✅ Countdown shown       | ✅ Countdown         | Visual  |
| 3 pending limit      | ✅ Queue visible              | ✅ Queue visible         | ✅ Queue             | Managed |

---

## 4.2 DM Pairing Commands

| OpenClaw Command                           | Desktop             | Web                    | Mobile                       | Notes   |
| ------------------------------------------ | ------------------- | ---------------------- | ---------------------------- | ------- |
| `openclaw pairing list telegram`           | ✅ Pairing panel    | ✅ Notifications panel | ✅ Push + list               | Visual  |
| `openclaw pairing approve telegram <CODE>` | ✅ "Approve" button | ✅ "Approve" button    | ✅ "Approve" in notification | One-tap |

---

## 4.3 Pairing State Storage

| OpenClaw Location          | Desktop                   | Web                    | Mobile      | Notes           |
| -------------------------- | ------------------------- | ---------------------- | ----------- | --------------- |
| `<channel>-pairing.json`   | ✅ Internal SQLite        | ✅ Cloud DB            | ✅ Cloud DB | Invisible       |
| `<channel>-allowFrom.json` | ✅ Internal + Contacts UI | ✅ Cloud + Contacts UI | ✅ Cloud    | Visual contacts |

---

## 4.4 Device Pairing (Node Access)

| OpenClaw Feature                 | Desktop             | Web                 | Mobile              | Notes   |
| -------------------------------- | ------------------- | ------------------- | ------------------- | ------- |
| iOS/Android/macOS/headless nodes | ✅ Devices panel    | ✅ Devices panel    | ✅ Devices panel    | Visual  |
| `openclaw devices list`          | ✅ Devices panel    | ✅ Devices panel    | ✅ Devices panel    | Visual  |
| `openclaw devices approve <id>`  | ✅ "Approve" button | ✅ "Approve" button | ✅ "Approve" button | One-tap |
| `openclaw devices reject <id>`   | ✅ "Reject" button  | ✅ "Reject" button  | ✅ "Reject" button  | One-tap |

---

## 4.5 Device State Storage

| OpenClaw Location | Desktop                  | Web                   | Mobile   | Notes     |
| ----------------- | ------------------------ | --------------------- | -------- | --------- |
| `pending.json`    | ✅ Internal              | ✅ Cloud              | ✅ Cloud | Invisible |
| `paired.json`     | ✅ Internal + Devices UI | ✅ Cloud + Devices UI | ✅ Cloud | Visual    |

---

# 5. OPENCLAW PERSONAL ASSISTANT (openclaw.md)

## 5.1 Safety Considerations

| OpenClaw Warning             | Desktop                   | Web                  | Mobile                | Notes        |
| ---------------------------- | ------------------------- | -------------------- | --------------------- | ------------ |
| Always set allowFrom         | ✅ Required in onboarding | ✅ N/A (no WhatsApp) | ⚡ Desktop onboarding | Enforced     |
| Use dedicated number         | ✅ Guidance in onboarding | ✅ N/A               | ⚡ Desktop            | Guided       |
| Disable heartbeats initially | ✅ Default: OFF           | ✅ Default: OFF      | ✅ Default: OFF       | Safe default |

---

## 5.2 Installation Requirements

| OpenClaw Requirement    | Desktop              | Web       | Mobile     | Notes                 |
| ----------------------- | -------------------- | --------- | ---------- | --------------------- |
| Node.js ≥22             | ✅ Bundled           | ✅ Server | ✅ N/A     | Invisible             |
| Global openclaw install | ✅ Bundled           | ✅ N/A    | ✅ N/A     | Invisible             |
| Secondary phone number  | ✅ Guidance in setup | ❌ N/A    | ⚡ Desktop | Required for WhatsApp |

---

## 5.3 Quick Start Process

| OpenClaw Step                   | Desktop                    | Web      | Mobile     | Notes     |
| ------------------------------- | -------------------------- | -------- | ---------- | --------- |
| `openclaw channels login` (QR)  | ✅ "Connect WhatsApp" → QR | ❌ N/A   | ⚡ Desktop | Visual    |
| `openclaw gateway --port 18789` | ✅ Auto-start              | ✅ Cloud | ✅ Cloud   | Invisible |
| Configure allowlisted numbers   | ✅ Contact picker UI       | ❌ N/A   | ⚡ Desktop | Visual    |

---

## 5.4 Workspace Configuration

| OpenClaw File | Desktop               | Web                   | Mobile             | Notes  |
| ------------- | --------------------- | --------------------- | ------------------ | ------ |
| AGENTS.md     | ✅ Agent config UI    | ✅ Agent config UI    | ✅ Agent config UI | Visual |
| SOUL.md       | ✅ Personality editor | ✅ Personality editor | 🔮 View only       | Visual |
| TOOLS.md      | ✅ Tools panel        | ✅ Tools panel        | ✅ Tools panel     | Visual |
| IDENTITY.md   | ✅ Identity editor    | ✅ Identity editor    | 🔮 View only       | Visual |
| USER.md       | ✅ User profile       | ✅ User profile       | ✅ User profile    | Visual |
| BOOTSTRAP.md  | ✅ Startup config     | ✅ Startup config     | 🔮 View only       | Visual |

---

## 5.5 Agent Customization

| OpenClaw Config     | Desktop            | Web                | Mobile      | Notes  |
| ------------------- | ------------------ | ------------------ | ----------- | ------ |
| Model selection     | ✅ Dropdown        | ✅ Dropdown        | ✅ Dropdown | Visual |
| Thinking defaults   | ✅ Toggle          | ✅ Toggle          | ✅ Toggle   | Visual |
| Timeout settings    | ✅ Slider          | ✅ Slider          | 🔮 Default  | Visual |
| Heartbeat intervals | ✅ Slider + toggle | ✅ Slider + toggle | ✅ Toggle   | Visual |

---

## 5.6 Session Management

| OpenClaw Feature            | Desktop              | Web                  | Mobile               | Notes  |
| --------------------------- | -------------------- | -------------------- | -------------------- | ------ |
| `/new` or `/reset` commands | ✅ "New Chat" button | ✅ "New Chat" button | ✅ "New Chat" button | Visual |
| `reset.mode` config         | ✅ Settings toggle   | ✅ Settings toggle   | ✅ Settings toggle   | Visual |
| `reset.atHour` config       | ✅ Time picker       | ✅ Time picker       | 🔮 Default           | Visual |

---

## 5.7 Heartbeat System

| OpenClaw Feature      | Desktop               | Web         | Mobile           | Notes       |
| --------------------- | --------------------- | ----------- | ---------------- | ----------- |
| Configure interval    | ✅ Slider (0m to 60m) | ✅ Slider   | ✅ Toggle on/off | Visual      |
| HEARTBEAT.md prompt   | ✅ Editable           | ✅ Editable | 🔮 View only     | Visual      |
| HEARTBEAT_OK response | ✅ Visible in logs    | ✅ Visible  | ✅ Visible       | Transparent |

---

## 5.8 Media Handling

| OpenClaw Feature           | Desktop             | Web                   | Mobile              | Notes     |
| -------------------------- | ------------------- | --------------------- | ------------------- | --------- |
| `{{MediaPath}}` template   | ✅ Auto-handled     | ✅ Auto-handled       | ✅ Auto-handled     | Invisible |
| `{{MediaUrl}}` template    | ✅ Auto-handled     | ✅ Auto-handled       | ✅ Auto-handled     | Invisible |
| `{{Transcript}}` for voice | ✅ Auto-transcribed | ✅ Auto-transcribed   | ✅ Auto-transcribed | Invisible |
| `MEDIA:<path>` outbound    | ✅ Drag-drop files  | ✅ File upload button | ✅ Photo picker     | Visual    |

---

## 5.9 Diagnostic Commands

| OpenClaw Command         | Desktop                       | Web              | Mobile              | Notes          |
| ------------------------ | ----------------------------- | ---------------- | ------------------- | -------------- |
| `openclaw status`        | ✅ System Health panel        | ✅ Status bar    | ✅ Status indicator | Always visible |
| `openclaw status --all`  | ✅ Detailed diagnostics panel | ✅ Detailed view | 🔮 Basic            | Visual         |
| `openclaw health --json` | ✅ Export logs                | ✅ API endpoint  | ❌ N/A              | Dev feature    |

---

# Summary: Platform Capabilities

## Desktop (Full Power)

- ✅ ALL features supported
- ✅ WhatsApp, Telegram, Discord, all channels
- ✅ Local file access
- ✅ MCP servers
- ✅ Browser automation
- ✅ Smart home (local)
- ✅ Works offline

## Web (Cloud Power)

- ✅ Chat with Claude
- ✅ Calendar, Email, Tasks integrations
- ✅ Cloud skills
- ✅ Multi-device sync
- ❌ WhatsApp/Telegram (needs Desktop)
- ❌ Local files
- ❌ MCP servers
- ⚡ Can control Desktop remotely

## Mobile (Companion)

- ✅ Chat with Claude
- ✅ Cloud integrations
- ✅ Push notifications
- ✅ Pairing approvals
- ✅ Quick responses
- ⚡ Bridge to Desktop for local features
- 🔮 Voice input (future)

---

# Friction Score Card

| Category      | OpenClaw Steps            | Helix Steps    | Reduction |
| ------------- | ------------------------- | -------------- | --------- |
| Installation  | 4-5                       | 1              | 80%       |
| Configuration | 9 wizard steps            | 4-5 visual     | 50%       |
| Channel setup | 3-4 commands              | 1-2 clicks     | 75%       |
| Pairing       | 2 commands                | 1 click        | 50%       |
| Monitoring    | 3 commands                | Always visible | 100%      |
| **TOTAL**     | **~20 terminal commands** | **~5 clicks**  | **75%**   |
