#!/usr/bin/env python3
"""
HELIX LAYER 5: MEMORY DECAY
Integration Rhythms - Memory Reconsolidation

Implements gradual decay of emotional intensity over time,
based on Memory Reconsolidation research (Nader et al., 2000).

Designed to be run via cron:
  0 0 * * * python3 /path/to/scripts/decay.py

Configuration via environment:
  HELIX_DECAY_RATE=0.95    # Daily retention rate (0.95 = 5% decay per day)
  HELIX_MIN_INTENSITY=0.1  # Floor for emotional intensity
  HELIX_DRY_RUN=true       # Don't write changes, just report
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Configuration
DECAY_RATE = float(os.getenv("HELIX_DECAY_RATE", "0.95"))
MIN_INTENSITY = float(os.getenv("HELIX_MIN_INTENSITY", "0.1"))
DRY_RUN = os.getenv("HELIX_DRY_RUN", "false").lower() == "true"

# Paths relative to script location
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent

# Files to process
EMOTIONAL_TAGS_FILE = PROJECT_ROOT / "psychology" / "emotional_tags.json"
TRUST_MAP_FILE = PROJECT_ROOT / "psychology" / "trust_map.json"


def load_json(path: Path) -> dict[str, Any] | None:
    """Load JSON file, return None on error."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"[ERROR] Failed to load {path}: {e}", file=sys.stderr)
        return None


def save_json(path: Path, data: dict[str, Any]) -> bool:
    """Save JSON file, return success status."""
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except IOError as e:
        print(f"[ERROR] Failed to save {path}: {e}", file=sys.stderr)
        return False


def apply_decay(value: float, rate: float, minimum: float) -> float:
    """Apply exponential decay with floor."""
    decayed = value * rate
    return max(decayed, minimum)


def decay_emotional_tags(data: dict[str, Any]) -> tuple[dict[str, Any], int]:
    """
    Apply decay to emotional tags intensity values.

    Returns: (modified_data, count_of_decayed_items)
    """
    count = 0

    if "tags" not in data:
        return data, 0

    for tag in data["tags"]:
        if "intensity" in tag:
            old_val = tag["intensity"]
            new_val = apply_decay(old_val, DECAY_RATE, MIN_INTENSITY)

            if new_val != old_val:
                tag["intensity"] = round(new_val, 3)
                tag["last_decay"] = datetime.utcnow().isoformat() + "Z"
                count += 1

                if DRY_RUN:
                    print(f"  [DRY RUN] {tag.get('name', 'unknown')}: {old_val:.3f} -> {new_val:.3f}")

    if not DRY_RUN and count > 0:
        data["_last_decay_run"] = datetime.utcnow().isoformat() + "Z"

    return data, count


def decay_trust_scores(data: dict[str, Any]) -> tuple[dict[str, Any], int]:
    """
    Apply decay to trust scores that haven't been reinforced.
    Trust naturally decays toward neutral (0.5) over time without interaction.

    Returns: (modified_data, count_of_decayed_items)
    """
    count = 0
    neutral = 0.5

    if "relationships" not in data:
        return data, 0

    for rel in data["relationships"]:
        if "trust_score" in rel:
            old_val = rel["trust_score"]

            # Decay toward neutral (0.5), not toward zero
            if old_val > neutral:
                new_val = neutral + (old_val - neutral) * DECAY_RATE
            elif old_val < neutral:
                new_val = neutral - (neutral - old_val) * DECAY_RATE
            else:
                new_val = old_val

            # Only apply if change is significant
            if abs(new_val - old_val) > 0.001:
                rel["trust_score"] = round(new_val, 3)
                rel["last_decay"] = datetime.utcnow().isoformat() + "Z"
                count += 1

                if DRY_RUN:
                    name = rel.get("entity", "unknown")
                    print(f"  [DRY RUN] {name}: {old_val:.3f} -> {new_val:.3f}")

    if not DRY_RUN and count > 0:
        data["_last_decay_run"] = datetime.utcnow().isoformat() + "Z"

    return data, count


def main() -> int:
    """Run decay processing on psychological layer files."""
    print(f"[HELIX] Layer 5 Decay Process - {datetime.utcnow().isoformat()}Z")
    print(f"  Rate: {DECAY_RATE} | Min: {MIN_INTENSITY} | Dry Run: {DRY_RUN}")
    print()

    total_changes = 0

    # Process emotional tags
    print(f"Processing: {EMOTIONAL_TAGS_FILE}")
    emotional_data = load_json(EMOTIONAL_TAGS_FILE)
    if emotional_data:
        emotional_data, count = decay_emotional_tags(emotional_data)
        total_changes += count
        print(f"  Decayed {count} emotional tag(s)")

        if not DRY_RUN and count > 0:
            if save_json(EMOTIONAL_TAGS_FILE, emotional_data):
                print("  Saved successfully")
            else:
                print("  [ERROR] Failed to save")
                return 1
    print()

    # Process trust map
    print(f"Processing: {TRUST_MAP_FILE}")
    trust_data = load_json(TRUST_MAP_FILE)
    if trust_data:
        trust_data, count = decay_trust_scores(trust_data)
        total_changes += count
        print(f"  Decayed {count} trust score(s)")

        if not DRY_RUN and count > 0:
            if save_json(TRUST_MAP_FILE, trust_data):
                print("  Saved successfully")
            else:
                print("  [ERROR] Failed to save")
                return 1
    print()

    print(f"[HELIX] Decay complete. Total changes: {total_changes}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
