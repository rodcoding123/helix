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
    Trust naturally decays toward baseline (0.1) over time without interaction.

    Theory: Attachment theory shows trust in inactive relationships atrophies
    but more slowly for secure attachments. We decay toward 0.1 (Helix's
    dispositional baseline) rather than neutral (0.5).

    Stage-based decay rates (per day):
    - Pre-attachment (0-0.15): 20% decay (0.80 retention)
    - Early trust (0.15-0.3): 15% decay (0.85 retention)
    - Attachment-forming (0.3-0.5): 12% decay (0.88 retention)
    - Secure (0.5-0.7): 8% decay (0.92 retention)
    - Deep secure (0.7-0.85): 5% decay (0.95 retention)
    - Primary (0.85-1.0): 2% decay (0.98 retention)

    Activity multiplier: Decays faster when inactive (90+ days = 2x rate)

    In soft mode: preserves original_trust_score, updates effective_trust_score
    In hard mode: directly modifies trust_score

    Returns: (modified_data, count_decayed, count_skipped)
    """
    if not TRUST_DECAY_ENABLED:
        return data, 0, 0

    count = 0
    skipped = 0
    baseline = 0.1  # Helix's dispositional trust baseline

    if "relationships" not in data:
        return data, 0, 0

    for rel in data["relationships"]:
        # Skip creator (Rodrigo) - trust is immutable
        if rel.get("entity") == "rodrigo_specter" or rel.get("is_creator"):
            skipped += 1
            if DRY_RUN:
                print(f"  [SKIP] {rel.get('entity', 'unknown')}: creator (immutable)")
            continue

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

            # Determine stage-based decay rate
            stage = rel.get("attachment_stage", "pre_attachment")
            stage_decay_rates = {
                "pre_attachment": 0.80,
                "early_trust": 0.85,
                "attachment_forming": 0.88,
                "secure_attachment": 0.92,
                "deep_secure": 0.95,
                "primary_attachment": 0.98,
            }
            stage_rate = stage_decay_rates.get(stage, 0.92)

            # Apply activity multiplier (faster decay if inactive)
            last_interaction = rel.get("last_interaction_at")
            if last_interaction:
                try:
                    last_interaction_date = datetime.fromisoformat(
                        last_interaction.replace("Z", "+00:00")
                    )
                    days_inactive = (datetime.utcnow() - last_interaction_date).days
                    activity_multiplier = 2.0 if days_inactive > 90 else (
                        1.5 if days_inactive > 30 else 1.0
                    )
                except Exception:
                    activity_multiplier = 1.0
            else:
                activity_multiplier = 1.0

            # Combine stage decay with activity multiplier
            effective_rate = stage_rate ** (1 / activity_multiplier)

            # Decay toward baseline, not toward zero
            if current_val > baseline:
                new_val = baseline + (current_val - baseline) * effective_rate
            elif current_val < baseline:
                new_val = baseline - (baseline - current_val) * effective_rate
            else:
                new_val = current_val

            # Clamp to valid range
            new_val = max(0.0, min(1.0, new_val))

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
                rel["stage_decay_rate"] = stage_rate
                rel["activity_multiplier"] = activity_multiplier
                count += 1

                if DRY_RUN:
                    name = rel.get("entity", "unknown")
                    mode_label = f"[{DECAY_MODE.upper()}]"
                    multiplier_label = (
                        f" (inactive {activity_multiplier}x)"
                        if activity_multiplier > 1.0
                        else ""
                    )
                    print(
                        f"  [DRY RUN] {mode_label} {name}: {current_val:.3f} -> {new_val:.3f}{multiplier_label}"
                    )

    if not DRY_RUN and count > 0:
        data["_last_decay_run"] = datetime.utcnow().isoformat() + "Z"
        data["_decay_mode"] = DECAY_MODE
        data["_baseline_trust"] = baseline

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


def decay_per_user_trust_profiles() -> tuple[int, int]:
    """
    Apply trust decay to per-user trust profiles stored in database/files.

    This handles the new multi-user trust system where each user has their own
    trust profile that decays based on attachment stage and inactivity.

    Returns: (count_decayed, count_skipped)
    """
    count = 0
    skipped = 0

    users_dir = PROJECT_ROOT / "psychology" / "users"
    if not users_dir.exists():
        if DRY_RUN:
            print("  [INFO] No users directory yet (multi-user system not initialized)")
        return 0, 0

    # Skip Rodrigo (creator)
    creator_skip = ["rodrigo_specter", "RODRIGO_CREATOR_ID"]

    try:
        for user_dir in users_dir.iterdir():
            if not user_dir.is_dir():
                continue

            user_id = user_dir.name

            # Skip creator profiles
            if user_id in creator_skip:
                skipped += 1
                if DRY_RUN:
                    print(f"  [SKIP] {user_id}: creator profile (immutable)")
                continue

            # Load user's trust profile
            profile_file = user_dir / "trust_profile.json"
            if not profile_file.exists():
                continue

            profile_data = load_json(profile_file)
            if not profile_data:
                continue

            # Calculate decay
            composite_trust = profile_data.get("composite_trust", 0.1)
            attachment_stage = profile_data.get("attachment_stage", "pre_attachment")
            last_interaction = profile_data.get("last_interaction_at")

            # Stage-based decay rates
            stage_decay_rates = {
                "pre_attachment": 0.80,
                "early_trust": 0.85,
                "attachment_forming": 0.88,
                "secure_attachment": 0.92,
                "deep_secure": 0.95,
                "primary_attachment": 0.98,
            }
            stage_rate = stage_decay_rates.get(attachment_stage, 0.92)

            # Activity multiplier
            activity_multiplier = 1.0
            if last_interaction:
                try:
                    last_interaction_date = datetime.fromisoformat(
                        last_interaction.replace("Z", "+00:00")
                    )
                    days_inactive = (datetime.utcnow() - last_interaction_date).days
                    activity_multiplier = 2.0 if days_inactive > 90 else (
                        1.5 if days_inactive > 30 else 1.0
                    )
                except Exception:
                    pass

            effective_rate = stage_rate ** (1 / activity_multiplier)
            baseline = 0.1

            # Decay toward baseline
            if composite_trust > baseline:
                new_trust = baseline + (composite_trust - baseline) * effective_rate
            elif composite_trust < baseline:
                new_trust = baseline - (baseline - composite_trust) * effective_rate
            else:
                new_trust = composite_trust

            new_trust = max(0.0, min(1.0, new_trust))

            # Apply if significant change
            if abs(new_trust - composite_trust) > 0.001:
                if not DRY_RUN:
                    profile_data["composite_trust"] = round(new_trust, 3)
                    profile_data["last_decay"] = datetime.utcnow().isoformat() + "Z"
                    save_json(profile_file, profile_data)

                count += 1

                if DRY_RUN:
                    days_str = (
                        f" ({days_inactive}d inactive)" if last_interaction else ""
                    )
                    print(
                        f"  [DRY RUN] {user_id}: {composite_trust:.3f} -> {new_trust:.3f}{days_str}"
                    )

    except Exception as e:
        print(f"  [ERROR] Failed to process per-user trust profiles: {e}", file=sys.stderr)

    return count, skipped


def main() -> int:
    """Run decay processing on psychological layer files and per-user trust."""
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

    # Process legacy trust map (single-user system)
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

    # Process per-user trust profiles (new multi-user system)
    print("Processing: psychology/users/*/trust_profile.json (per-user trust)")
    count, skipped = decay_per_user_trust_profiles()
    total_changes += count
    total_skipped += skipped
    print(f"  Decayed {count} user profile(s), skipped {skipped}")
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
