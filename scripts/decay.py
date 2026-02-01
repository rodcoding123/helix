#!/usr/bin/env python3
"""
HELIX LAYER 5: MEMORY DECAY
Integration Rhythms - Memory Reconsolidation

Implements gradual decay of emotional intensity over time,
based on Memory Reconsolidation research (Nader et al., 2000).

Designed to be run via cron:
  0 0 * * * python3 /path/to/scripts/decay.py

Configuration via environment:
  HELIX_DECAY_RATE=0.95          # Daily retention rate (0.95 = 5% decay per day)
  HELIX_MIN_INTENSITY=0.1        # Floor for emotional intensity
  HELIX_DECAY_MODE=soft          # soft = preserve data, hard = permanent decay
  HELIX_TRUST_DECAY=true         # Whether trust scores decay
  HELIX_PRESERVE_HIGH_SALIENCE=true  # Never decay critical/high salience
  HELIX_DRY_RUN=true             # Don't write changes, just report
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
DECAY_MODE = os.getenv("HELIX_DECAY_MODE", "soft").lower()  # soft or hard
TRUST_DECAY_ENABLED = os.getenv("HELIX_TRUST_DECAY", "true").lower() == "true"
PRESERVE_HIGH_SALIENCE = os.getenv("HELIX_PRESERVE_HIGH_SALIENCE", "true").lower() == "true"
DRY_RUN = os.getenv("HELIX_DRY_RUN", "false").lower() == "true"

# High salience tiers that should never decay
HIGH_SALIENCE_TIERS = {"critical", "high"}

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


def should_skip_decay(tag: dict[str, Any]) -> bool:
    """Check if a tag should be skipped based on salience tier."""
    if not PRESERVE_HIGH_SALIENCE:
        return False

    salience_tier = tag.get("salience_tier", "").lower()
    return salience_tier in HIGH_SALIENCE_TIERS


def decay_emotional_tags(data: dict[str, Any]) -> tuple[dict[str, Any], int, int]:
    """
    Apply decay to emotional tags intensity values.

    In soft mode: preserves original_intensity, updates effective_intensity
    In hard mode: directly modifies intensity

    Returns: (modified_data, count_decayed, count_skipped)
    """
    count = 0
    skipped = 0

    if "tags" not in data:
        return data, 0, 0

    for tag in data["tags"]:
        # Check if we should skip this tag
        if should_skip_decay(tag):
            skipped += 1
            if DRY_RUN:
                print(f"  [SKIP] {tag.get('name', 'unknown')}: high salience ({tag.get('salience_tier', 'unknown')})")
            continue

        if "intensity" in tag:
            # Get the current value to decay
            if DECAY_MODE == "soft":
                # In soft mode, decay from effective_intensity or intensity
                current_val = tag.get("effective_intensity", tag["intensity"])
                original_val = tag.get("original_intensity", tag["intensity"])
            else:
                current_val = tag["intensity"]
                original_val = current_val

            new_val = apply_decay(current_val, DECAY_RATE, MIN_INTENSITY)

            if abs(new_val - current_val) > 0.001:
                if DECAY_MODE == "soft":
                    # Soft mode: preserve original, update effective
                    if "original_intensity" not in tag:
                        tag["original_intensity"] = tag["intensity"]
                    tag["effective_intensity"] = round(new_val, 3)
                    tag["decay_cycles"] = tag.get("decay_cycles", 0) + 1
                else:
                    # Hard mode: directly modify intensity
                    tag["intensity"] = round(new_val, 3)

                tag["last_decay"] = datetime.utcnow().isoformat() + "Z"
                tag["decay_mode"] = DECAY_MODE
                count += 1

                if DRY_RUN:
                    mode_label = f"[{DECAY_MODE.upper()}]"
                    print(f"  [DRY RUN] {mode_label} {tag.get('name', 'unknown')}: {current_val:.3f} -> {new_val:.3f}")

    if not DRY_RUN and count > 0:
        data["_last_decay_run"] = datetime.utcnow().isoformat() + "Z"
        data["_decay_mode"] = DECAY_MODE
        data["_decay_rate"] = DECAY_RATE

    return data, count, skipped


def decay_trust_scores(data: dict[str, Any]) -> tuple[dict[str, Any], int, int]:
    """
    Apply decay to trust scores that haven't been reinforced.
    Trust naturally decays toward neutral (0.5) over time without interaction.

    In soft mode: preserves original_trust_score, updates effective_trust_score
    In hard mode: directly modifies trust_score

    Returns: (modified_data, count_decayed, count_skipped)
    """
    if not TRUST_DECAY_ENABLED:
        return data, 0, 0

    count = 0
    skipped = 0
    neutral = 0.5

    if "relationships" not in data:
        return data, 0, 0

    for rel in data["relationships"]:
        # Skip primary attachments if preserve high salience is enabled
        if PRESERVE_HIGH_SALIENCE and rel.get("attachment_type") == "primary":
            skipped += 1
            if DRY_RUN:
                print(f"  [SKIP] {rel.get('entity', 'unknown')}: primary attachment")
            continue

        if "trust_score" in rel:
            # Get the current value to decay
            if DECAY_MODE == "soft":
                current_val = rel.get("effective_trust_score", rel["trust_score"])
            else:
                current_val = rel["trust_score"]

            # Decay toward neutral (0.5), not toward zero
            if current_val > neutral:
                new_val = neutral + (current_val - neutral) * DECAY_RATE
            elif current_val < neutral:
                new_val = neutral - (neutral - current_val) * DECAY_RATE
            else:
                new_val = current_val

            # Only apply if change is significant
            if abs(new_val - current_val) > 0.001:
                if DECAY_MODE == "soft":
                    # Soft mode: preserve original, update effective
                    if "original_trust_score" not in rel:
                        rel["original_trust_score"] = rel["trust_score"]
                    rel["effective_trust_score"] = round(new_val, 3)
                    rel["decay_cycles"] = rel.get("decay_cycles", 0) + 1
                else:
                    # Hard mode: directly modify trust_score
                    rel["trust_score"] = round(new_val, 3)

                rel["last_decay"] = datetime.utcnow().isoformat() + "Z"
                rel["decay_mode"] = DECAY_MODE
                count += 1

                if DRY_RUN:
                    name = rel.get("entity", "unknown")
                    mode_label = f"[{DECAY_MODE.upper()}]"
                    print(f"  [DRY RUN] {mode_label} {name}: {current_val:.3f} -> {new_val:.3f}")

    if not DRY_RUN and count > 0:
        data["_last_decay_run"] = datetime.utcnow().isoformat() + "Z"
        data["_decay_mode"] = DECAY_MODE

    return data, count, skipped


def restore_from_soft_decay(data: dict[str, Any], field_type: str = "emotional") -> tuple[dict[str, Any], int]:
    """
    Restore all soft-decayed values to their originals.
    This allows users to "remember everything" after using soft decay.

    Returns: (modified_data, count_restored)
    """
    count = 0

    if field_type == "emotional" and "tags" in data:
        for tag in data["tags"]:
            if "original_intensity" in tag:
                tag["intensity"] = tag["original_intensity"]
                del tag["original_intensity"]
                if "effective_intensity" in tag:
                    del tag["effective_intensity"]
                if "decay_cycles" in tag:
                    del tag["decay_cycles"]
                tag["restored_at"] = datetime.utcnow().isoformat() + "Z"
                count += 1

    elif field_type == "trust" and "relationships" in data:
        for rel in data["relationships"]:
            if "original_trust_score" in rel:
                rel["trust_score"] = rel["original_trust_score"]
                del rel["original_trust_score"]
                if "effective_trust_score" in rel:
                    del rel["effective_trust_score"]
                if "decay_cycles" in rel:
                    del rel["decay_cycles"]
                rel["restored_at"] = datetime.utcnow().isoformat() + "Z"
                count += 1

    return data, count


def main() -> int:
    """Run decay processing on psychological layer files."""
    print(f"[HELIX] Layer 5 Decay Process - {datetime.utcnow().isoformat()}Z")
    print(f"  Rate: {DECAY_RATE} | Min: {MIN_INTENSITY} | Mode: {DECAY_MODE}")
    print(f"  Trust Decay: {TRUST_DECAY_ENABLED} | Preserve High Salience: {PRESERVE_HIGH_SALIENCE}")
    print(f"  Dry Run: {DRY_RUN}")
    print()

    total_changes = 0
    total_skipped = 0

    # Process emotional tags
    print(f"Processing: {EMOTIONAL_TAGS_FILE}")
    emotional_data = load_json(EMOTIONAL_TAGS_FILE)
    if emotional_data:
        emotional_data, count, skipped = decay_emotional_tags(emotional_data)
        total_changes += count
        total_skipped += skipped
        print(f"  Decayed {count} emotional tag(s), skipped {skipped}")

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
        trust_data, count, skipped = decay_trust_scores(trust_data)
        total_changes += count
        total_skipped += skipped
        print(f"  Decayed {count} trust score(s), skipped {skipped}")

        if not DRY_RUN and count > 0:
            if save_json(TRUST_MAP_FILE, trust_data):
                print("  Saved successfully")
            else:
                print("  [ERROR] Failed to save")
                return 1
    print()

    print(f"[HELIX] Decay complete. Total changes: {total_changes}, Total skipped: {total_skipped}")
    return 0


if __name__ == "__main__":
    # Check for restore command
    if len(sys.argv) > 1 and sys.argv[1] == "--restore":
        print("[HELIX] Restoring from soft decay...")

        emotional_data = load_json(EMOTIONAL_TAGS_FILE)
        if emotional_data:
            emotional_data, count = restore_from_soft_decay(emotional_data, "emotional")
            if count > 0:
                save_json(EMOTIONAL_TAGS_FILE, emotional_data)
                print(f"  Restored {count} emotional tags")

        trust_data = load_json(TRUST_MAP_FILE)
        if trust_data:
            trust_data, count = restore_from_soft_decay(trust_data, "trust")
            if count > 0:
                save_json(TRUST_MAP_FILE, trust_data)
                print(f"  Restored {count} trust scores")

        print("[HELIX] Restore complete.")
        sys.exit(0)

    sys.exit(main())
