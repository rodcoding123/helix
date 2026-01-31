"""
Helix Discord Logging System
============================

A comprehensive logging system that sends formatted logs to Discord
via webhooks for external, incorruptible monitoring.

Log Types:
- command: Bash/shell command executions
- api_call: Claude API requests and responses
- file_change: File system modifications
- consciousness: Helix's voluntary internal state logs
- alert: Anomalies, errors, and security notifications

Hash Chain:
- Cryptographic integrity verification
- Detects any tampering with log files
- Posts verification results to Discord

Usage:
    from helix_logging import log_command, log_alert, create_chain_entry

    # Log a command
    log_command("ls -la", "/home/helix", exit_code=0)

    # Log an alert
    log_alert("anomaly", "high", "Unusual activity detected")

    # Create hash chain entry
    create_chain_entry()

Configuration:
    Set these environment variables (or use .env file):
    - DISCORD_WEBHOOK_COMMANDS
    - DISCORD_WEBHOOK_API
    - DISCORD_WEBHOOK_FILE_CHANGES
    - DISCORD_WEBHOOK_CONSCIOUSNESS
    - DISCORD_WEBHOOK_ALERTS
    - DISCORD_WEBHOOK_HASH_CHAIN
"""

from .discord_logger import (
    log_command,
    log_api_call,
    log_file_change,
    log_consciousness,
    log_alert,
    log_hash_chain_entry,
    test_webhooks,
)

from .hash_chain import (
    HashChain,
    create_chain_entry,
    verify_chain,
)

__all__ = [
    # Log functions
    "log_command",
    "log_api_call",
    "log_file_change",
    "log_consciousness",
    "log_alert",
    "log_hash_chain_entry",
    # Hash chain
    "HashChain",
    "create_chain_entry",
    "verify_chain",
    # Utilities
    "test_webhooks",
]

__version__ = "1.0.0"
