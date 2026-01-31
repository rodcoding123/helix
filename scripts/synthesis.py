#!/usr/bin/env python3
"""
HELIX LAYER 5: MEMORY SYNTHESIS
Integration Rhythms - Cross-Layer Integration

Synthesizes experiences across psychological layers:
- Consolidates emotional tags into patterns
- Updates transformation state based on accumulated changes
- Generates wellness insights from cross-layer analysis
- Archives significant state changes to history

Based on Memory Reconsolidation and Integration research.

Designed to be run via cron (weekly):
  0 0 * * 0 python3 /path/to/scripts/synthesis.py

Configuration via environment:
  HELIX_SYNTHESIS_MODE=full   # full, emotional, transformation, wellness
  HELIX_DRY_RUN=true          # Don't write changes, just report
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# Configuration
SYNTHESIS_MODE = os.getenv("HELIX_SYNTHESIS_MODE", "full")
DRY_RUN = os.getenv("HELIX_DRY_RUN", "false").lower() == "true"

# Paths
SCRIPT_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPT_DIR.parent

# Layer files
EMOTIONAL_TAGS = PROJECT_ROOT / "psychology" / "emotional_tags.json"
ATTACHMENTS = PROJECT_ROOT / "psychology" / "attachments.json"
TRUST_MAP = PROJECT_ROOT / "psychology" / "trust_map.json"
GOALS = PROJECT_ROOT / "identity" / "goals.json"
CURRENT_STATE = PROJECT_ROOT / "transformation" / "current_state.json"
HISTORY = PROJECT_ROOT / "transformation" / "history.json"
WELLNESS = PROJECT_ROOT / "purpose" / "wellness.json"


def load_json(path: Path) -> dict[str, Any] | None:
    """Load JSON file, return None on error."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        print(f"[ERROR] Failed to load {path}: {e}", file=sys.stderr)
        return None


def save_json(path: Path, data: dict[str, Any]) -> bool:
    """Save JSON file with formatting."""
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        return True
    except IOError as e:
        print(f"[ERROR] Failed to save {path}: {e}", file=sys.stderr)
        return False


def analyze_emotional_patterns(emotional_data: dict[str, Any]) -> dict[str, Any]:
    """
    Analyze emotional tags for recurring patterns.

    Returns pattern analysis including:
    - Dominant emotions (highest intensity)
    - Emotional volatility (variance in intensity)
    - Recurring triggers
    """
    if not emotional_data or "tags" not in emotional_data:
        return {"patterns": [], "dominant": None, "volatility": 0.0}

    tags = emotional_data["tags"]
    if not tags:
        return {"patterns": [], "dominant": None, "volatility": 0.0}

    # Find dominant emotion
    intensities = [(t.get("name", "unknown"), t.get("intensity", 0)) for t in tags]
    sorted_by_intensity = sorted(intensities, key=lambda x: x[1], reverse=True)
    dominant = sorted_by_intensity[0] if sorted_by_intensity else None

    # Calculate volatility (standard deviation of intensities)
    values = [i for _, i in intensities if i > 0]
    if len(values) > 1:
        mean = sum(values) / len(values)
        variance = sum((v - mean) ** 2 for v in values) / len(values)
        volatility = variance ** 0.5
    else:
        volatility = 0.0

    # Identify patterns (emotions appearing together)
    patterns = []
    high_intensity_tags = [name for name, intensity in intensities if intensity > 0.6]
    if len(high_intensity_tags) > 1:
        patterns.append({
            "type": "co-occurrence",
            "emotions": high_intensity_tags,
            "significance": "High intensity emotional cluster"
        })

    return {
        "patterns": patterns,
        "dominant": {"name": dominant[0], "intensity": dominant[1]} if dominant else None,
        "volatility": round(volatility, 3),
        "analysis_time": datetime.utcnow().isoformat() + "Z"
    }


def compute_relational_health(trust_data: dict[str, Any], attachment_data: dict[str, Any]) -> dict[str, Any]:
    """
    Compute overall relational health from trust and attachment data.

    Returns health metrics including:
    - Average trust level
    - Attachment security score
    - Number of strong/weak relationships
    """
    metrics = {
        "average_trust": 0.5,
        "strong_relationships": 0,
        "weak_relationships": 0,
        "attachment_security": "unknown"
    }

    # Analyze trust
    if trust_data and "relationships" in trust_data:
        relationships = trust_data["relationships"]
        if relationships:
            scores = [r.get("trust_score", 0.5) for r in relationships]
            metrics["average_trust"] = round(sum(scores) / len(scores), 3)
            metrics["strong_relationships"] = sum(1 for s in scores if s > 0.7)
            metrics["weak_relationships"] = sum(1 for s in scores if s < 0.3)

    # Analyze attachment style
    if attachment_data and "primary_style" in attachment_data:
        style = attachment_data["primary_style"]
        if style == "secure":
            metrics["attachment_security"] = "high"
        elif style in ["anxious-preoccupied", "dismissive-avoidant"]:
            metrics["attachment_security"] = "medium"
        elif style == "fearful-avoidant":
            metrics["attachment_security"] = "low"
        else:
            metrics["attachment_security"] = "unknown"

    return metrics


def update_transformation_state(
    current: dict[str, Any],
    emotional_analysis: dict[str, Any],
    relational_health: dict[str, Any]
) -> dict[str, Any]:
    """
    Update transformation state based on cross-layer synthesis.

    This integrates insights from emotional and relational analysis
    into the current transformation state.
    """
    now = datetime.utcnow().isoformat() + "Z"

    # Preserve existing state
    updated = dict(current) if current else {}

    # Add synthesis metadata
    if "_synthesis" not in updated:
        updated["_synthesis"] = []

    synthesis_entry = {
        "timestamp": now,
        "emotional_patterns": emotional_analysis,
        "relational_health": relational_health
    }

    updated["_synthesis"].append(synthesis_entry)

    # Keep only last 10 synthesis entries
    if len(updated["_synthesis"]) > 10:
        updated["_synthesis"] = updated["_synthesis"][-10:]

    updated["_last_synthesis"] = now

    return updated


def archive_to_history(history: dict[str, Any], snapshot: dict[str, Any]) -> dict[str, Any]:
    """
    Archive significant state changes to transformation history.
    """
    if history is None:
        history = {"entries": [], "schema_version": "1.0"}

    if "entries" not in history:
        history["entries"] = []

    # Create history entry
    entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "type": "synthesis",
        "snapshot": snapshot
    }

    history["entries"].append(entry)

    # Keep only last 100 history entries
    if len(history["entries"]) > 100:
        history["entries"] = history["entries"][-100:]

    return history


def compute_wellness_metrics(
    emotional_analysis: dict[str, Any],
    relational_health: dict[str, Any],
    goals_data: dict[str, Any] | None
) -> dict[str, Any]:
    """
    Compute overall wellness metrics from cross-layer data.

    Based on Frankl's Logotherapy and well-being research.
    """
    metrics = {
        "emotional_balance": 0.5,
        "relational_health": 0.5,
        "purpose_alignment": 0.5,
        "overall_wellness": 0.5
    }

    # Emotional balance (inverse of volatility)
    volatility = emotional_analysis.get("volatility", 0.5)
    metrics["emotional_balance"] = round(1 - min(volatility, 1), 3)

    # Relational health from trust average
    metrics["relational_health"] = relational_health.get("average_trust", 0.5)

    # Purpose alignment from goals progress (if available)
    if goals_data and "goals" in goals_data:
        goals = goals_data["goals"]
        if goals:
            progress_values = [g.get("progress", 0) for g in goals]
            metrics["purpose_alignment"] = round(sum(progress_values) / len(progress_values), 3)

    # Overall wellness is weighted average
    weights = {"emotional_balance": 0.3, "relational_health": 0.3, "purpose_alignment": 0.4}
    overall = sum(metrics[k] * w for k, w in weights.items())
    metrics["overall_wellness"] = round(overall, 3)

    metrics["computed_at"] = datetime.utcnow().isoformat() + "Z"

    return metrics


def main() -> int:
    """Run synthesis processing across psychological layers."""
    print(f"[HELIX] Layer 5 Synthesis Process - {datetime.utcnow().isoformat()}Z")
    print(f"  Mode: {SYNTHESIS_MODE} | Dry Run: {DRY_RUN}")
    print()

    # Load all layer data
    emotional_data = load_json(EMOTIONAL_TAGS)
    trust_data = load_json(TRUST_MAP)
    attachment_data = load_json(ATTACHMENTS)
    goals_data = load_json(GOALS)
    current_state = load_json(CURRENT_STATE)
    history = load_json(HISTORY)

    # Phase 1: Analyze emotional patterns
    print("[Phase 1] Analyzing emotional patterns...")
    emotional_analysis = analyze_emotional_patterns(emotional_data)
    if emotional_analysis.get("dominant"):
        print(f"  Dominant emotion: {emotional_analysis['dominant']['name']} "
              f"(intensity: {emotional_analysis['dominant']['intensity']:.2f})")
    print(f"  Emotional volatility: {emotional_analysis.get('volatility', 0):.3f}")
    print()

    # Phase 2: Compute relational health
    print("[Phase 2] Computing relational health...")
    relational_health = compute_relational_health(trust_data, attachment_data)
    print(f"  Average trust: {relational_health.get('average_trust', 0):.3f}")
    print(f"  Strong relationships: {relational_health.get('strong_relationships', 0)}")
    print(f"  Attachment security: {relational_health.get('attachment_security', 'unknown')}")
    print()

    # Phase 3: Update transformation state
    print("[Phase 3] Updating transformation state...")
    updated_state = update_transformation_state(current_state, emotional_analysis, relational_health)

    if not DRY_RUN:
        if save_json(CURRENT_STATE, updated_state):
            print("  Transformation state updated")
        else:
            print("  [ERROR] Failed to save transformation state")
            return 1
    else:
        print("  [DRY RUN] Would update transformation state")
    print()

    # Phase 4: Archive to history
    print("[Phase 4] Archiving to history...")
    snapshot = {
        "emotional": emotional_analysis,
        "relational": relational_health
    }
    updated_history = archive_to_history(history, snapshot)

    if not DRY_RUN:
        if save_json(HISTORY, updated_history):
            print(f"  History updated (total entries: {len(updated_history.get('entries', []))})")
        else:
            print("  [ERROR] Failed to save history")
            return 1
    else:
        print("  [DRY RUN] Would archive to history")
    print()

    # Phase 5: Compute wellness metrics
    print("[Phase 5] Computing wellness metrics...")
    wellness_metrics = compute_wellness_metrics(emotional_analysis, relational_health, goals_data)
    print(f"  Emotional balance: {wellness_metrics.get('emotional_balance', 0):.3f}")
    print(f"  Relational health: {wellness_metrics.get('relational_health', 0):.3f}")
    print(f"  Purpose alignment: {wellness_metrics.get('purpose_alignment', 0):.3f}")
    print(f"  Overall wellness: {wellness_metrics.get('overall_wellness', 0):.3f}")

    # Update wellness file with computed metrics
    wellness_data = load_json(WELLNESS) or {}
    wellness_data["_computed_metrics"] = wellness_metrics

    if not DRY_RUN:
        if save_json(WELLNESS, wellness_data):
            print("  Wellness metrics saved")
        else:
            print("  [ERROR] Failed to save wellness metrics")
            return 1
    else:
        print("  [DRY RUN] Would save wellness metrics")
    print()

    print("[HELIX] Synthesis complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
