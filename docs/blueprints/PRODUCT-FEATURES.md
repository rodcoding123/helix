# Helix Product Feature Roadmap

> Derived from OpenClaw showcase analysis and friction reduction

---

## Feature Classification

### BY VALUE TO USER

| Tier | Description | Example |
|------|-------------|---------|
| **S-Tier** | "Wow, this changed my life" | $4,200 car savings |
| **A-Tier** | Daily active use | Morning briefings |
| **B-Tier** | Weekly active use | Expense tracking |
| **C-Tier** | Occasional use | Flight check-in |
| **D-Tier** | Nice to have | Custom themes |

### BY IMPLEMENTATION COMPLEXITY

| Level | Description | Dev Time |
|-------|-------------|----------|
| **Trivial** | Config/UI only | Hours |
| **Simple** | Single integration | Days |
| **Medium** | Multiple integrations | 1-2 weeks |
| **Complex** | New architecture | 2-4 weeks |
| **Hard** | Major R&D | 1+ months |

---

## Core Features (Must Have)

### 1. Messaging Gateway ⭐ S-TIER / COMPLEX
**What:** Connect WhatsApp, Telegram, Discord to Claude
**Why:** Core value proposition
**User Quote:** "I want to text my computer and it does things"

**Implementation:**
- Already built in OpenClaw
- Helix packages it with GUI
- No changes to core logic

---

### 2. Visual Onboarding ⭐ A-TIER / MEDIUM
**What:** Step-by-step setup wizard with no terminal
**Why:** 90% of users quit at installation

**Steps:**
1. Welcome screen
2. Create account (optional)
3. API key setup (guided links)
4. Connect first channel (QR for WhatsApp)
5. Send test message
6. Done!

---

### 3. Settings Dashboard ⭐ A-TIER / SIMPLE
**What:** GUI for all configuration
**Why:** JSON editing is unacceptable for consumers

**Panels:**
- General (appearance, language)
- Model (provider, API keys)
- Channels (connected platforms)
- Privacy (data handling)
- Advanced (power user settings)

---

### 4. Contact Pairing ⭐ A-TIER / TRIVIAL
**What:** Visual approve/deny for incoming contacts
**Why:** Current CLI approval is hostile

**UI:**
- Notification when new contact messages
- "Approve" / "Block" buttons
- Contact list management
- Trusted contacts visible

---

### 5. Session Management ⭐ A-TIER / SIMPLE
**What:** View, search, export chat history
**Why:** Users need to find past conversations

**Features:**
- Session list with search
- Export to Markdown/JSON
- Archive/Delete
- Resume any session

---

## Automation Features (High Value)

### 6. Browser Automation ⭐ S-TIER / COMPLEX
**What:** Control websites without APIs
**Why:** Most services don't have APIs

**Showcase Examples:**
- Tesco grocery ordering
- TradingView chart capture
- School meal booking
- Car price negotiation

**Implementation:**
- Playwright integration
- Visual scripting (optional)
- Template library

---

### 7. Scheduled Tasks ⭐ A-TIER / MEDIUM
**What:** Cron-style recurring automations
**Why:** "Morning briefing" is most requested

**Examples from Showcase:**
- Daily morning summary
- Weekly reviews
- Expense tracking reminders
- Calendar conflict alerts

**UI:**
- Schedule builder
- Task templates
- History/logs
- Enable/disable toggle

---

### 8. File & Media Handling ⭐ A-TIER / SIMPLE
**What:** Send/receive files through chat
**Why:** Users want to share screenshots, PDFs, etc.

**Features:**
- Drag-drop file sending
- Automatic image recognition
- PDF text extraction
- Voice note transcription

---

## Integration Features (Ecosystem)

### 9. Calendar Integration ⭐ A-TIER / MEDIUM
**What:** Read/write calendar events
**Why:** #1 requested integration

**Providers:**
- Google Calendar
- Apple Calendar
- Outlook/Exchange
- CalDAV (self-hosted)

**Capabilities:**
- View schedule
- Create events
- Time blocking
- Conflict detection

---

### 10. Smart Home Control ⭐ B-TIER / MEDIUM
**What:** Control home devices via chat
**Why:** 10% of showcase users do this

**Integrations:**
- Home Assistant (priority)
- HomeKit
- Alexa/Echo
- Google Home
- Individual devices (Philips Hue, etc.)

---

### 11. Email Integration ⭐ A-TIER / MEDIUM
**What:** Read, send, organize email
**Why:** High-value automation target

**Providers:**
- Gmail
- Outlook
- Fastmail
- IMAP (generic)

**Capabilities:**
- Digest summaries
- Send on behalf
- Filter rules
- Reply drafts

---

### 12. Note-Taking Integration ⭐ B-TIER / SIMPLE
**What:** Sync with knowledge bases
**Why:** Users want persistent memory

**Providers:**
- Notion
- Obsidian
- Apple Notes
- Roam
- Markdown files

---

### 13. Task Management ⭐ A-TIER / SIMPLE
**What:** Manage todos via chat
**Why:** Universal need

**Providers:**
- Todoist
- Linear
- Jira
- Notion databases
- Apple Reminders

---

## Developer Features (Power Users)

### 14. GitHub Integration ⭐ A-TIER / MEDIUM
**What:** PRs, issues, code review
**Why:** Developers are early adopters

**Capabilities:**
- Create PRs
- Review code
- Manage issues
- Deploy triggers

---

### 15. MCP Server Support ⭐ B-TIER / MEDIUM
**What:** Install local tool servers
**Why:** Extensibility for power users

**UI:**
- Server browser
- One-click install
- Status monitoring
- Config editor

---

### 16. Custom Skills ⭐ B-TIER / COMPLEX
**What:** User-created automations
**Why:** Infinite extensibility

**Features:**
- Skill marketplace (ClawHub equivalent)
- Visual skill builder
- Template library
- Share with community

---

## Voice Features (Growing)

### 17. Voice Input ⭐ B-TIER / MEDIUM
**What:** Speak instead of type
**Why:** Hands-free usage

**Showcase Examples:**
- Voice-controlled deployment (@georgedagg_)
- Voice learning tools (@joshp123)
- Pebble ring integration (@thekitze)

**Implementation:**
- Whisper for transcription
- Push-to-talk
- Voice activity detection
- Wake word (optional)

---

### 18. Voice Output ⭐ C-TIER / MEDIUM
**What:** AI speaks responses
**Why:** Complete voice experience

**Options:**
- ElevenLabs
- OpenAI TTS
- System voices
- Custom voice cloning

---

## Multi-User Features (Future)

### 19. Shared Memory ⭐ B-TIER / COMPLEX
**What:** Multiple users share knowledge
**Why:** Family/team use cases

**Showcase Example:**
- @christinetyip: shared memory with partner

**Implementation:**
- Memory sync between instances
- Permission levels
- Conflict resolution

---

### 20. Multi-Agent Orchestration ⭐ C-TIER / HARD
**What:** Multiple specialized agents
**Why:** Power user workflows

**Showcase Example:**
- @adam91holt: 14+ agents with Opus coordinator
- @iamtrebuh: Strategy/dev/marketing agents

---

## Feature Priority Matrix

```
                    HIGH VALUE
                        │
     ┌──────────────────┼──────────────────┐
     │                  │                  │
     │  Calendar        │   Browser        │
     │  Email           │   Automation     │
     │  Tasks           │                  │
     │  GitHub          │                  │
LOW  │──────────────────┼──────────────────│ HIGH
EFFORT│                  │                  │ EFFORT
     │  Voice Input     │   Custom Skills  │
     │  Note Sync       │   Multi-Agent    │
     │  Smart Home      │   Shared Memory  │
     │                  │                  │
     └──────────────────┼──────────────────┘
                        │
                    LOW VALUE
```

---

## MVP Feature Set

### Phase 1 (Launch)
1. ✅ Messaging gateway (WhatsApp, Telegram)
2. ✅ Visual onboarding
3. ✅ Settings dashboard
4. ✅ Contact pairing UI
5. ✅ Session management
6. ✅ Basic file handling

### Phase 2 (Month 2)
7. Scheduled tasks
8. Calendar integration
9. Email integration
10. Voice input

### Phase 3 (Month 3)
11. Browser automation
12. Task management
13. Note-taking sync
14. Smart home basics

### Phase 4 (Month 4+)
15. MCP servers
16. Custom skills
17. Skill marketplace
18. Multi-user features

---

## Competitive Differentiation

### vs ChatGPT App
- ✅ Works with YOUR apps (WhatsApp, Telegram)
- ✅ Local data (privacy)
- ✅ Automation capabilities
- ❌ Less polished initially

### vs Zapier/Make
- ✅ Natural language (no flowcharts)
- ✅ AI understands context
- ✅ Real-time chat interface
- ❌ Fewer integrations initially

### vs Custom AI Agents
- ✅ No coding required
- ✅ Pre-built integrations
- ✅ Consumer-friendly
- ❌ Less flexible than raw code
