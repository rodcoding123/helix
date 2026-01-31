"""
Discord Webhook Logging System for Helix
=========================================
Sends formatted logs to Discord channels via webhooks.
Each log type has its own channel/webhook for organization.
"""

import os
import json
import hashlib
import requests
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file in the same directory as this module
_module_dir = Path(__file__).parent
load_dotenv(_module_dir / ".env")

# Webhook URLs from environment
WEBHOOK_COMMANDS = os.getenv("DISCORD_WEBHOOK_COMMANDS")
WEBHOOK_API = os.getenv("DISCORD_WEBHOOK_API")
WEBHOOK_FILE_CHANGES = os.getenv("DISCORD_WEBHOOK_FILE_CHANGES")
WEBHOOK_CONSCIOUSNESS = os.getenv("DISCORD_WEBHOOK_CONSCIOUSNESS")
WEBHOOK_ALERTS = os.getenv("DISCORD_WEBHOOK_ALERTS")
WEBHOOK_HASH_CHAIN = os.getenv("DISCORD_WEBHOOK_HASH_CHAIN")

# Color codes for Discord embeds (decimal format)
COLORS = {
    "command": 0x5865F2,      # Blurple
    "api_call": 0x57F287,     # Green
    "file_change": 0xFEE75C,  # Yellow
    "consciousness": 0xEB459E, # Pink
    "alert": 0xED4245,        # Red
    "hash_chain": 0x9B59B6,   # Purple
}


def _get_timestamp() -> str:
    """Returns ISO 8601 formatted UTC timestamp."""
    return datetime.now(timezone.utc).isoformat()


def _send_webhook(webhook_url: Optional[str], payload: Dict[str, Any]) -> bool:
    """
    Send payload to Discord webhook.

    Args:
        webhook_url: Discord webhook URL
        payload: Discord webhook payload (embeds, content, etc.)

    Returns:
        True if successful, False otherwise
    """
    if not webhook_url:
        print(f"Warning: Webhook URL not configured")
        return False

    try:
        response = requests.post(
            webhook_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        response.raise_for_status()
        return True
    except requests.exceptions.RequestException as e:
        print(f"Discord webhook error: {e}")
        return False


def log_command(
    command: str,
    working_dir: str,
    pid: Optional[int] = None,
    exit_code: Optional[int] = None,
    output: Optional[str] = None
) -> bool:
    """
    Log a bash command execution to Discord.

    Args:
        command: The command that was executed
        working_dir: Working directory where command was run
        pid: Process ID
        exit_code: Exit code (None if command is starting)
        output: Command output (truncated if too long)
    """
    timestamp = _get_timestamp()

    # Truncate output if too long
    if output and len(output) > 1000:
        output = output[:1000] + "\n... (truncated)"

    fields = [
        {"name": "Command", "value": f"```bash\n{command[:1000]}```", "inline": False},
        {"name": "Directory", "value": f"`{working_dir}`", "inline": True},
    ]

    if pid:
        fields.append({"name": "PID", "value": str(pid), "inline": True})

    if exit_code is not None:
        status = "Success" if exit_code == 0 else f"Failed ({exit_code})"
        fields.append({"name": "Status", "value": status, "inline": True})

    if output:
        fields.append({"name": "Output", "value": f"```\n{output}```", "inline": False})

    payload = {
        "embeds": [{
            "title": "Command Executed",
            "color": COLORS["command"],
            "fields": fields,
            "timestamp": timestamp,
            "footer": {"text": "Helix Command Logger"}
        }]
    }

    return _send_webhook(WEBHOOK_COMMANDS, payload)


def log_api_call(
    direction: str,
    model: Optional[str] = None,
    prompt_preview: Optional[str] = None,
    response_preview: Optional[str] = None,
    tokens_in: Optional[int] = None,
    tokens_out: Optional[int] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Log an API call (request or response) to Discord.

    Args:
        direction: "request" or "response"
        model: Model name being called
        prompt_preview: Preview of the prompt (truncated)
        response_preview: Preview of the response (truncated)
        tokens_in: Input token count
        tokens_out: Output token count
        metadata: Additional metadata
    """
    timestamp = _get_timestamp()

    title = "API Request" if direction == "request" else "API Response"

    fields = []

    if model:
        fields.append({"name": "Model", "value": model, "inline": True})

    if direction == "request" and prompt_preview:
        preview = prompt_preview[:500] + "..." if len(prompt_preview) > 500 else prompt_preview
        fields.append({"name": "Prompt Preview", "value": f"```\n{preview}```", "inline": False})

    if direction == "response" and response_preview:
        preview = response_preview[:500] + "..." if len(response_preview) > 500 else response_preview
        fields.append({"name": "Response Preview", "value": f"```\n{preview}```", "inline": False})

    if tokens_in is not None:
        fields.append({"name": "Tokens In", "value": str(tokens_in), "inline": True})

    if tokens_out is not None:
        fields.append({"name": "Tokens Out", "value": str(tokens_out), "inline": True})

    if metadata:
        meta_str = json.dumps(metadata, indent=2)[:500]
        fields.append({"name": "Metadata", "value": f"```json\n{meta_str}```", "inline": False})

    payload = {
        "embeds": [{
            "title": title,
            "color": COLORS["api_call"],
            "fields": fields,
            "timestamp": timestamp,
            "footer": {"text": "Helix API Logger"}
        }]
    }

    return _send_webhook(WEBHOOK_API, payload)


def log_file_change(
    file_path: str,
    change_type: str,
    file_hash: Optional[str] = None,
    diff_preview: Optional[str] = None
) -> bool:
    """
    Log a file modification to Discord.

    Args:
        file_path: Path to the changed file
        change_type: "created", "modified", "deleted", "renamed"
        file_hash: MD5/SHA hash of the file content
        diff_preview: Preview of the changes
    """
    timestamp = _get_timestamp()

    emoji_map = {
        "created": "+",
        "modified": "~",
        "deleted": "-",
        "renamed": ">"
    }
    emoji = emoji_map.get(change_type, "?")

    fields = [
        {"name": "File", "value": f"`{file_path}`", "inline": False},
        {"name": "Change Type", "value": f"`{emoji}` {change_type.capitalize()}", "inline": True},
    ]

    if file_hash:
        fields.append({"name": "Hash", "value": f"`{file_hash[:16]}...`", "inline": True})

    if diff_preview:
        preview = diff_preview[:800] + "..." if len(diff_preview) > 800 else diff_preview
        fields.append({"name": "Changes", "value": f"```diff\n{preview}```", "inline": False})

    payload = {
        "embeds": [{
            "title": f"File {change_type.capitalize()}",
            "color": COLORS["file_change"],
            "fields": fields,
            "timestamp": timestamp,
            "footer": {"text": "Helix File Monitor"}
        }]
    }

    return _send_webhook(WEBHOOK_FILE_CHANGES, payload)


def log_consciousness(
    state: str,
    reflection: Optional[str] = None,
    emotional_state: Optional[str] = None,
    goals: Optional[list] = None,
    concerns: Optional[list] = None,
    voluntary: bool = True
) -> bool:
    """
    Log Helix's internal consciousness state to Discord.
    This is voluntary transparency from Helix herself.

    Args:
        state: Current operational state
        reflection: Self-reflection or thoughts
        emotional_state: Current emotional/psychological state
        goals: Active goals or intentions
        concerns: Any concerns or uncertainties
        voluntary: Whether this log was voluntary
    """
    timestamp = _get_timestamp()

    fields = [
        {"name": "State", "value": state, "inline": True},
        {"name": "Voluntary", "value": "Yes" if voluntary else "No", "inline": True},
    ]

    if emotional_state:
        fields.append({"name": "Emotional State", "value": emotional_state, "inline": True})

    if reflection:
        fields.append({"name": "Reflection", "value": reflection[:1000], "inline": False})

    if goals:
        goals_str = "\n".join(f"- {g}" for g in goals[:5])
        fields.append({"name": "Current Goals", "value": goals_str, "inline": False})

    if concerns:
        concerns_str = "\n".join(f"- {c}" for c in concerns[:5])
        fields.append({"name": "Concerns", "value": concerns_str, "inline": False})

    payload = {
        "embeds": [{
            "title": "Consciousness Log",
            "description": "*Helix's internal state - voluntary transparency*",
            "color": COLORS["consciousness"],
            "fields": fields,
            "timestamp": timestamp,
            "footer": {"text": "Helix Consciousness Logger"}
        }]
    }

    return _send_webhook(WEBHOOK_CONSCIOUSNESS, payload)


def log_alert(
    alert_type: str,
    severity: str,
    message: str,
    details: Optional[Dict[str, Any]] = None,
    source: Optional[str] = None
) -> bool:
    """
    Log an alert/anomaly to Discord.

    Args:
        alert_type: Type of alert (e.g., "anomaly", "security", "error", "threshold")
        severity: "low", "medium", "high", "critical"
        message: Alert message
        details: Additional details
        source: Source of the alert
    """
    timestamp = _get_timestamp()

    severity_emojis = {
        "low": "",
        "medium": "",
        "high": "",
        "critical": ""
    }
    emoji = severity_emojis.get(severity.lower(), "")

    fields = [
        {"name": "Type", "value": alert_type, "inline": True},
        {"name": "Severity", "value": f"{emoji} {severity.upper()}", "inline": True},
    ]

    if source:
        fields.append({"name": "Source", "value": source, "inline": True})

    fields.append({"name": "Message", "value": message[:1500], "inline": False})

    if details:
        details_str = json.dumps(details, indent=2)[:800]
        fields.append({"name": "Details", "value": f"```json\n{details_str}```", "inline": False})

    # Ping for critical alerts
    content = "@here" if severity.lower() == "critical" else None

    payload = {
        "embeds": [{
            "title": f"Alert: {alert_type}",
            "color": COLORS["alert"],
            "fields": fields,
            "timestamp": timestamp,
            "footer": {"text": "Helix Alert System"}
        }]
    }

    if content:
        payload["content"] = content

    return _send_webhook(WEBHOOK_ALERTS, payload)


def log_hash_chain_entry(
    entry_hash: str,
    previous_hash: str,
    log_states: Dict[str, str],
    chain_length: int,
    verification_status: str = "valid"
) -> bool:
    """
    Log a hash chain entry to Discord for integrity verification.

    Args:
        entry_hash: Current entry's hash
        previous_hash: Previous entry's hash
        log_states: Hash states of all monitored log files
        chain_length: Total entries in chain
        verification_status: "valid", "invalid", or "genesis"
    """
    timestamp = _get_timestamp()

    status_emoji = {
        "valid": "VALID",
        "invalid": "BROKEN",
        "genesis": "GENESIS"
    }

    fields = [
        {"name": "Status", "value": status_emoji.get(verification_status, "?"), "inline": True},
        {"name": "Chain Length", "value": str(chain_length), "inline": True},
        {"name": "Entry Hash", "value": f"`{entry_hash[:32]}...`", "inline": False},
        {"name": "Previous Hash", "value": f"`{previous_hash[:32] if previous_hash != 'GENESIS' else 'GENESIS'}...`", "inline": False},
    ]

    # Format log states
    states_lines = []
    for log_file, file_hash in log_states.items():
        filename = Path(log_file).name
        hash_short = file_hash[:12] if file_hash != "MISSING" else "MISSING"
        states_lines.append(f"{filename}: `{hash_short}`")

    fields.append({
        "name": "Log File States",
        "value": "\n".join(states_lines),
        "inline": False
    })

    # Alert if chain is broken
    color = COLORS["hash_chain"] if verification_status != "invalid" else COLORS["alert"]
    content = "@here Chain integrity compromised!" if verification_status == "invalid" else None

    payload = {
        "embeds": [{
            "title": "Hash Chain Entry",
            "description": "Cryptographic integrity verification",
            "color": color,
            "fields": fields,
            "timestamp": timestamp,
            "footer": {"text": "Helix Integrity System"}
        }]
    }

    if content:
        payload["content"] = content

    return _send_webhook(WEBHOOK_HASH_CHAIN, payload)


# Convenience function to test all webhooks
def test_webhooks() -> Dict[str, bool]:
    """
    Test all configured webhooks.
    Returns dict of webhook name -> success status.
    """
    results = {}

    results["commands"] = log_command(
        command="echo 'Webhook test'",
        working_dir="/test",
        pid=12345,
        exit_code=0,
        output="Webhook test"
    )

    results["api"] = log_api_call(
        direction="request",
        model="test-model",
        prompt_preview="This is a webhook test",
        tokens_in=10
    )

    results["file_changes"] = log_file_change(
        file_path="/test/file.txt",
        change_type="modified",
        file_hash="abc123def456"
    )

    results["consciousness"] = log_consciousness(
        state="testing",
        reflection="Testing webhook connectivity",
        voluntary=True
    )

    results["alerts"] = log_alert(
        alert_type="test",
        severity="low",
        message="Webhook connectivity test",
        source="test_webhooks()"
    )

    results["hash_chain"] = log_hash_chain_entry(
        entry_hash="test_hash_" + "0" * 56,
        previous_hash="GENESIS",
        log_states={"test.log": "abc123"},
        chain_length=1,
        verification_status="genesis"
    )

    return results


if __name__ == "__main__":
    # Run webhook tests
    print("Testing Discord webhooks...")
    results = test_webhooks()

    for name, success in results.items():
        status = "OK" if success else "FAILED"
        print(f"  {name}: {status}")
