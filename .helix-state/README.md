# Helix State Directory

Isolated helix-runtime state, separate from global OpenClaw (`~/.openclaw/`).

## Contents

- `openclaw.json` - Helix-specific configuration
- `credentials/` - OAuth tokens
- `sessions/` - Session data
- `plugins/` - Plugin state

## Why Separate?

Helix is a desktop application with an internal OpenClaw runtime. This state directory keeps Helix's configuration isolated from any global OpenClaw installation on the user's machine, ensuring:

- Zero conflicts with global OpenClaw
- Each application maintains its own state
- Predictable behavior across all platforms

## Git Ignore

This directory is git-ignored except for this README, ensuring sensitive credentials and local state never leak into version control.
