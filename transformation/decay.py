#!/usr/bin/env python3
"""
HELIX LAYER 5: Memory Decay & Reconsolidation

Implements exponential decay for memories that lose relevance over time
and triggers reconsolidation of critical memories to strengthen them.

Follows Wicherts (2007): Memory traces naturally decay unless reinforced
through reconsolidation cycles triggered by retrieval and meaningful processing.
"""

import json
import math
from datetime import datetime, timedelta
from pathlib import Path
from typing import TypedDict


class MemoryTrace(TypedDict):
    """Memory trace with decay metadata"""
    id: str
    content: str
    importance: float  # 0.0-1.0
    created_at: str
    last_accessed_at: str
    access_count: int
    decay_rate: float  # Custom decay per memory
    needs_reconsolidation: bool


def calculate_decay(
    importance: float,
    created_at: str,
    last_accessed_at: str,
    access_count: int,
    custom_decay_rate: float = 0.05
) -> float:
    """
    Calculate memory strength with exponential decay.

    Formula: S(t) = S₀ × e^(-t×d) + e^(ln(i))
    where:
    - S₀ = initial strength (importance)
    - t = time since last access (days)
    - d = decay rate (per day)
    - i = importance (0.0-1.0) acts as minimum floor

    Args:
        importance: Initial importance (0.0-1.0)
        created_at: ISO 8601 creation timestamp
        last_accessed_at: ISO 8601 last access timestamp
        access_count: Total number of times accessed
        custom_decay_rate: Custom decay constant (default 0.05)

    Returns:
        Current memory strength (0.0-1.0)
    """
    try:
        now = datetime.fromisoformat(datetime.now().isoformat())
        last_access = datetime.fromisoformat(last_accessed_at)

        # Time since last access in days
        days_since_access = (now - last_access).total_seconds() / (24 * 3600)

        # Apply decay formula
        # Higher access count slows decay (reinforcement effect)
        effective_decay = custom_decay_rate / max(1, math.log(access_count + 1))
        decayed_strength = importance * math.exp(-days_since_access * effective_decay)

        # Importance creates a floor (critical memories don't decay below importance)
        strength = max(importance * 0.3, decayed_strength)  # 30% floor based on importance

        return min(1.0, max(0.0, strength))
    except (ValueError, OSError):
        # If timestamp parsing fails, return importance as fallback
        return importance


def flag_for_reconsolidation(
    strength: float,
    importance: float,
    access_count: int,
    days_since_access: float
) -> bool:
    """
    Flag memory for reconsolidation if:
    1. Strength has decayed significantly (< 0.3 × importance)
    2. Critical memory (importance > 0.8) not accessed in 7+ days
    3. Important memory (importance > 0.5) with low access count in 14+ days

    Args:
        strength: Current calculated strength
        importance: Original importance (0.0-1.0)
        access_count: Total accesses
        days_since_access: Days since last access

    Returns:
        True if memory should be reconsolidated
    """
    # Critical memories need frequent reconsolidation
    if importance > 0.8 and days_since_access > 7:
        return True

    # Decay threshold
    if strength < (importance * 0.3):
        return True

    # Rarely accessed important memories
    if importance > 0.5 and access_count < 3 and days_since_access > 14:
        return True

    return False


def apply_memory_decay(memories_file: Path) -> dict:
    """
    Apply exponential decay to all memories in a JSON file.

    Args:
        memories_file: Path to JSON file with memory array

    Returns:
        Report dict with decay statistics
    """
    report = {
        "timestamp": datetime.now().isoformat(),
        "total_memories": 0,
        "decayed": 0,
        "flagged_reconsolidation": 0,
        "memories": []
    }

    try:
        if not memories_file.exists():
            return {**report, "error": "Memory file not found"}

        with open(memories_file, 'r', encoding='utf-8') as f:
            memories = json.load(f)

        if not isinstance(memories, list):
            memories = [memories]  # Handle single object

        updated_memories = []

        for memory in memories:
            if not isinstance(memory, dict):
                continue

            report["total_memories"] += 1

            # Extract fields with defaults
            importance = memory.get("importance", 0.5)
            created_at = memory.get("created_at", datetime.now().isoformat())
            last_accessed = memory.get("last_accessed_at", created_at)
            access_count = memory.get("access_count", 0)
            decay_rate = memory.get("decay_rate", 0.05)

            # Calculate new strength
            strength = calculate_decay(
                importance=importance,
                created_at=created_at,
                last_accessed_at=last_accessed,
                access_count=access_count,
                custom_decay_rate=decay_rate
            )

            # Calculate days since access for reconsolidation check
            now = datetime.fromisoformat(datetime.now().isoformat())
            last_access = datetime.fromisoformat(last_accessed)
            days_since = (now - last_access).total_seconds() / (24 * 3600)

            # Check if memory needs reconsolidation
            needs_reconsolidation = flag_for_reconsolidation(
                strength=strength,
                importance=importance,
                access_count=access_count,
                days_since_access=days_since
            )

            if strength < importance:
                report["decayed"] += 1

            if needs_reconsolidation:
                report["flagged_reconsolidation"] += 1

            # Update memory with new metadata
            updated_memory = {
                **memory,
                "current_strength": round(strength, 3),
                "days_since_access": round(days_since, 1),
                "needs_reconsolidation": needs_reconsolidation,
                "last_decay_calc": datetime.now().isoformat()
            }

            updated_memories.append(updated_memory)
            report["memories"].append({
                "id": memory.get("id", "unknown"),
                "strength": round(strength, 3),
                "importance": importance,
                "needs_reconsolidation": needs_reconsolidation
            })

        # Save updated memories
        with open(memories_file, 'w', encoding='utf-8') as f:
            json.dump(updated_memories, f, indent=2)

        return report

    except json.JSONDecodeError as e:
        return {**report, "error": f"Invalid JSON: {str(e)}"}
    except Exception as e:
        return {**report, "error": str(e)}


def main():
    """Run memory decay calculation on Layer 5 files"""
    import sys

    # Default to transformation/layer5_memories.json
    memory_file = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("transformation/layer5_memories.json")

    if not memory_file.exists():
        print(f"[Helix] Layer 5: Memory file not found: {memory_file}")
        return

    print("[Helix] Layer 5: Applying memory decay...")
    report = apply_memory_decay(memory_file)

    print(f"[Helix] Layer 5: {report['total_memories']} memories processed")
    print(f"[Helix] Layer 5: {report['decayed']} memories decayed")
    print(f"[Helix] Layer 5: {report['flagged_reconsolidation']} flagged for reconsolidation")


if __name__ == "__main__":
    main()
