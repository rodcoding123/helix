"""
Hash Chain Integrity System for Helix
======================================
Creates cryptographic hash chains for log integrity verification.
Posts verification results to Discord for external auditing.
"""

import hashlib
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, List, Tuple

from .discord_logger import log_hash_chain_entry, log_alert


# Default log files to monitor (can be overridden)
DEFAULT_LOG_FILES = [
    "commands.log",
    "api_calls.log",
    "file_changes.log",
    "network.log",
    "system.log",
    "consciousness.log",
]


class HashChain:
    """
    Manages a cryptographic hash chain for log integrity verification.

    Each entry contains:
    - Timestamp
    - Previous entry's hash
    - Current state hashes of all monitored log files
    - Hash of the entire entry

    Tampering with any log file will break the chain.
    """

    def __init__(
        self,
        chain_file: str,
        log_directory: str,
        log_files: Optional[List[str]] = None,
        post_to_discord: bool = True
    ):
        """
        Initialize the hash chain.

        Args:
            chain_file: Path to the hash chain log file
            log_directory: Directory containing log files to monitor
            log_files: List of log filenames to monitor (default: DEFAULT_LOG_FILES)
            post_to_discord: Whether to post entries to Discord
        """
        self.chain_file = Path(chain_file)
        self.log_directory = Path(log_directory)
        self.log_files = log_files or DEFAULT_LOG_FILES
        self.post_to_discord = post_to_discord

        # Ensure chain file exists
        self.chain_file.parent.mkdir(parents=True, exist_ok=True)
        if not self.chain_file.exists():
            self.chain_file.touch()

    def _hash_file(self, file_path: Path) -> str:
        """Compute SHA-256 hash of a file's contents."""
        try:
            with open(file_path, 'rb') as f:
                return hashlib.sha256(f.read()).hexdigest()
        except FileNotFoundError:
            return "MISSING"
        except PermissionError:
            return "NO_ACCESS"
        except Exception as e:
            return f"ERROR:{type(e).__name__}"

    def _get_last_entry(self) -> Optional[Dict]:
        """Get the last entry in the chain."""
        try:
            with open(self.chain_file, 'r') as f:
                lines = f.readlines()
                if lines:
                    return json.loads(lines[-1].strip())
        except (json.JSONDecodeError, FileNotFoundError):
            pass
        return None

    def _get_last_hash(self) -> str:
        """Get the hash of the last entry, or 'GENESIS' if chain is empty."""
        last_entry = self._get_last_entry()
        if last_entry:
            return last_entry.get("hash", "GENESIS")
        return "GENESIS"

    def _compute_log_states(self) -> Dict[str, str]:
        """Compute current hash states of all monitored log files."""
        states = {}
        for log_file in self.log_files:
            file_path = self.log_directory / log_file
            states[str(file_path)] = self._hash_file(file_path)
        return states

    def _compute_entry_hash(self, timestamp: str, previous_hash: str, log_states: Dict[str, str]) -> str:
        """Compute the hash for a chain entry."""
        entry_content = json.dumps({
            "timestamp": timestamp,
            "previous_hash": previous_hash,
            "log_states": log_states
        }, sort_keys=True)
        return hashlib.sha256(entry_content.encode()).hexdigest()

    def get_chain_length(self) -> int:
        """Get the number of entries in the chain."""
        try:
            with open(self.chain_file, 'r') as f:
                return sum(1 for line in f if line.strip())
        except FileNotFoundError:
            return 0

    def create_entry(self) -> Dict:
        """
        Create a new hash chain entry.

        Returns:
            The created entry dict
        """
        timestamp = datetime.now(timezone.utc).isoformat()
        previous_hash = self._get_last_hash()
        log_states = self._compute_log_states()

        entry_hash = self._compute_entry_hash(timestamp, previous_hash, log_states)

        entry = {
            "timestamp": timestamp,
            "previous_hash": previous_hash,
            "log_states": log_states,
            "hash": entry_hash
        }

        # Append to chain file
        with open(self.chain_file, 'a') as f:
            f.write(json.dumps(entry) + "\n")

        # Post to Discord
        if self.post_to_discord:
            chain_length = self.get_chain_length()
            status = "genesis" if previous_hash == "GENESIS" else "valid"
            log_hash_chain_entry(
                entry_hash=entry_hash,
                previous_hash=previous_hash,
                log_states=log_states,
                chain_length=chain_length,
                verification_status=status
            )

        return entry

    def verify_chain(self) -> Tuple[bool, List[Dict]]:
        """
        Verify the entire hash chain integrity.

        Returns:
            Tuple of (is_valid, list_of_invalid_entries)
        """
        invalid_entries = []

        try:
            with open(self.chain_file, 'r') as f:
                lines = f.readlines()
        except FileNotFoundError:
            return True, []  # Empty chain is valid

        if not lines:
            return True, []

        previous_hash = "GENESIS"

        for i, line in enumerate(lines):
            try:
                entry = json.loads(line.strip())
            except json.JSONDecodeError:
                invalid_entries.append({
                    "index": i,
                    "reason": "Invalid JSON",
                    "line": line[:100]
                })
                continue

            # Verify previous hash link
            if entry.get("previous_hash") != previous_hash:
                invalid_entries.append({
                    "index": i,
                    "reason": "Previous hash mismatch",
                    "expected": previous_hash,
                    "found": entry.get("previous_hash")
                })

            # Verify entry hash
            computed_hash = self._compute_entry_hash(
                entry["timestamp"],
                entry["previous_hash"],
                entry["log_states"]
            )

            if computed_hash != entry.get("hash"):
                invalid_entries.append({
                    "index": i,
                    "reason": "Entry hash mismatch",
                    "expected": computed_hash,
                    "found": entry.get("hash")
                })

            previous_hash = entry.get("hash", "INVALID")

        is_valid = len(invalid_entries) == 0

        # Post verification result to Discord
        if self.post_to_discord:
            if is_valid:
                log_hash_chain_entry(
                    entry_hash=previous_hash,
                    previous_hash="(verification)",
                    log_states={"verification": "complete"},
                    chain_length=len(lines),
                    verification_status="valid"
                )
            else:
                # Alert on integrity failure
                log_alert(
                    alert_type="integrity",
                    severity="critical",
                    message=f"Hash chain integrity compromised! {len(invalid_entries)} invalid entries found.",
                    details={"invalid_entries": invalid_entries[:5]},  # Limit for Discord
                    source="HashChain.verify_chain()"
                )

        return is_valid, invalid_entries

    def verify_current_state(self) -> Tuple[bool, Dict[str, str]]:
        """
        Verify that current log file states match the last chain entry.

        Returns:
            Tuple of (matches, dict of files that changed)
        """
        last_entry = self._get_last_entry()
        if not last_entry:
            return True, {}

        current_states = self._compute_log_states()
        recorded_states = last_entry.get("log_states", {})

        changes = {}
        for file_path, current_hash in current_states.items():
            recorded_hash = recorded_states.get(file_path)
            if recorded_hash and recorded_hash != current_hash:
                changes[file_path] = {
                    "was": recorded_hash[:16],
                    "now": current_hash[:16] if current_hash not in ("MISSING", "NO_ACCESS") else current_hash
                }

        return len(changes) == 0, changes


def create_chain_entry(
    chain_file: str = "./logs/hash_chain.log",
    log_directory: str = "./logs",
    post_to_discord: bool = True
) -> str:
    """
    Convenience function to create a single hash chain entry.

    Args:
        chain_file: Path to the hash chain file
        log_directory: Directory containing log files
        post_to_discord: Whether to post to Discord

    Returns:
        The hash of the created entry
    """
    chain = HashChain(
        chain_file=chain_file,
        log_directory=log_directory,
        post_to_discord=post_to_discord
    )
    entry = chain.create_entry()
    return entry["hash"]


def verify_chain(
    chain_file: str = "./logs/hash_chain.log",
    log_directory: str = "./logs",
    post_to_discord: bool = True
) -> bool:
    """
    Convenience function to verify the entire hash chain.

    Args:
        chain_file: Path to the hash chain file
        log_directory: Directory containing log files
        post_to_discord: Whether to post results to Discord

    Returns:
        True if chain is valid, False otherwise
    """
    chain = HashChain(
        chain_file=chain_file,
        log_directory=log_directory,
        post_to_discord=post_to_discord
    )
    is_valid, invalid_entries = chain.verify_chain()

    if not is_valid:
        print(f"Chain verification FAILED! {len(invalid_entries)} invalid entries:")
        for entry in invalid_entries[:5]:
            print(f"  Entry {entry['index']}: {entry['reason']}")

    return is_valid


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "verify":
        # Verify existing chain
        print("Verifying hash chain...")
        is_valid = verify_chain()
        sys.exit(0 if is_valid else 1)
    else:
        # Create new entry
        print("Creating hash chain entry...")
        entry_hash = create_chain_entry()
        print(f"Entry created: {entry_hash[:32]}...")
