#!/usr/bin/env python3
"""
HELIX LAYER 5: Memory Synthesis & Integration Orchestration

Synthesizes memories from Layers 2-4 into integrated, actionable insights
that inform decision-making and identity evolution.

Implements Haxby & Tsao (2021): Memory consolidation requires active synthesis
of emotional (L2), relational (L3), and prospective (L4) dimensions to create
coherent narratives that guide behavior.
"""

import json
from datetime import datetime
from pathlib import Path
from typing import TypedDict, Optional, List


class SynthesisReport(TypedDict):
    """Synthesis integration report"""
    timestamp: str
    layer_2_memories: int  # Emotional tags
    layer_3_memories: int  # Relational/attachments
    layer_4_goals: int  # Prospective self
    synthesized_patterns: List[str]
    recommended_actions: List[str]
    confidence: float


def load_layer_file(file_path: Path) -> Optional[dict]:
    """Safely load a JSON layer file"""
    try:
        if not file_path.exists():
            return None
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return None


def synthesize_emotional_relational(
    emotional_tags: Optional[dict],
    attachments: Optional[dict]
) -> List[str]:
    """
    Synthesize Layer 2 (emotional) and Layer 3 (relational) into patterns.

    Pattern example: "Strong positive emotion towards person X creates
    secure attachment, supports goal Y"
    """
    patterns = []

    if not emotional_tags or not attachments:
        return patterns

    try:
        # Get emotional states
        emotions = emotional_tags.get("tags", {})
        relationships = attachments.get("attachments", [])

        for rel in relationships:
            if isinstance(rel, dict):
                person = rel.get("name", "unknown")
                bond_type = rel.get("type", "neutral")

                # Find matching emotions
                for emotion, data in emotions.items():
                    if isinstance(data, dict):
                        intensity = data.get("intensity", 0)
                        if intensity > 0.7:  # Strong emotion
                            pattern = f"Strong {emotion} toward {person} ({bond_type})"
                            patterns.append(pattern)

        return patterns
    except (KeyError, TypeError, AttributeError):
        return patterns


def synthesize_prospective_goals(
    goals: Optional[dict],
    attachments: Optional[dict],
    feared_self: Optional[dict]
) -> List[str]:
    """
    Synthesize Layer 4 (prospective self) with relational supports and feared futures.

    Creates goal-relationship-fear triangulations for motivation.
    """
    patterns = []

    if not goals:
        return patterns

    try:
        goal_list = goals.get("goals", [])
        supports = []
        fears = []

        if attachments:
            supports = [a.get("name", "unknown") for a in attachments.get("attachments", [])]

        if feared_self:
            fears = feared_self.get("fears", [])

        for goal in goal_list:
            if isinstance(goal, dict):
                title = goal.get("title", "unknown")
                importance = goal.get("importance", 0.5)

                if importance > 0.7:
                    # Connect to supports and fears
                    if supports:
                        pattern = f"Goal '{title}' supported by {supports[0]}"
                        patterns.append(pattern)

                    if fears:
                        pattern = f"Goal '{title}' counters feared: {fears[0] if isinstance(fears, list) else fears}"
                        patterns.append(pattern)

        return patterns
    except (KeyError, TypeError, AttributeError):
        return patterns


def generate_recommended_actions(
    patterns: List[str],
    current_state: Optional[dict]
) -> List[str]:
    """
    Generate actionable recommendations from synthesized patterns.

    Args:
        patterns: List of synthesized patterns
        current_state: Current psychological state (Layer 6)

    Returns:
        List of recommended actions
    """
    actions = []

    if not patterns:
        return ["Review Layer 5 synthesis for patterns"]

    try:
        for pattern in patterns:
            if "Strong" in pattern and "toward" in pattern:
                actions.append("Strengthen relationship through regular engagement")
            elif "Goal" in pattern and "supported" in pattern:
                actions.append("Schedule collaborative goal-work session")
            elif "Goal" in pattern and "counters" in pattern:
                actions.append("Use goal as antidote to feared outcome")

        # Add state-based recommendations
        if current_state:
            state = current_state.get("current_state", {})
            if isinstance(state, dict):
                if state.get("stress_level", 0) > 0.7:
                    actions.append("Increase self-care and relational support")
                if state.get("motivation", 0) < 0.4:
                    actions.append("Revisit core values and important relationships")

        # Remove duplicates
        actions = list(set(actions))

        return actions

    except (KeyError, TypeError, AttributeError):
        return ["Review synthesis output manually"]


def synthesize_all_layers(layer_dir: Path = Path("transformation")) -> SynthesisReport:
    """
    Execute full synthesis across all psychological layers.

    Args:
        layer_dir: Directory containing Layer files

    Returns:
        Comprehensive synthesis report
    """
    report: SynthesisReport = {
        "timestamp": datetime.now().isoformat(),
        "layer_2_memories": 0,
        "layer_3_memories": 0,
        "layer_4_goals": 0,
        "synthesized_patterns": [],
        "recommended_actions": [],
        "confidence": 0.0
    }

    try:
        # Load all layers
        layer_2 = load_layer_file(layer_dir / "psychology" / "emotional_tags.json")
        layer_3_attach = load_layer_file(layer_dir / "psychology" / "attachments.json")
        layer_3_trust = load_layer_file(layer_dir / "psychology" / "trust_map.json")
        layer_4 = load_layer_file(layer_dir / "identity" / "goals.json")
        layer_4_feared = load_layer_file(layer_dir / "identity" / "feared_self.json")
        layer_6 = load_layer_file(layer_dir / "transformation" / "current_state.json")

        # Count memories/goals
        if layer_2 and isinstance(layer_2.get("tags"), dict):
            report["layer_2_memories"] = len(layer_2["tags"])

        if layer_3_attach and isinstance(layer_3_attach.get("attachments"), list):
            report["layer_3_memories"] += len(layer_3_attach["attachments"])

        if layer_3_trust and isinstance(layer_3_trust.get("trust_scores"), dict):
            report["layer_3_memories"] += len(layer_3_trust["trust_scores"])

        if layer_4 and isinstance(layer_4.get("goals"), list):
            report["layer_4_goals"] = len(layer_4["goals"])

        # Execute synthesis
        patterns = []

        # 2-3 synthesis
        patterns.extend(synthesize_emotional_relational(layer_2, layer_3_attach))

        # 3-4 synthesis
        patterns.extend(synthesize_prospective_goals(layer_4, layer_3_attach, layer_4_feared))

        report["synthesized_patterns"] = patterns

        # Generate actions
        report["recommended_actions"] = generate_recommended_actions(patterns, layer_6)

        # Calculate confidence (based on data completeness)
        total_layers = 0
        layers_with_data = 0

        for layer in [layer_2, layer_3_attach, layer_3_trust, layer_4, layer_4_feared]:
            total_layers += 1
            if layer:
                layers_with_data += 1

        report["confidence"] = round(layers_with_data / max(1, total_layers), 2)

        return report

    except Exception as e:
        report["synthesized_patterns"] = [f"Error during synthesis: {str(e)}"]
        report["confidence"] = 0.0
        return report


def save_synthesis_report(report: SynthesisReport, output_path: Path) -> bool:
    """
    Save synthesis report to JSON file.

    Args:
        report: Synthesis report dict
        output_path: Path to save report

    Returns:
        True if successful
    """
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2)
        return True
    except Exception:
        return False


def main():
    """Run Layer 5 synthesis"""
    import sys

    layer_dir = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("transformation")

    print("[Helix] Layer 5: Starting memory synthesis...")
    print(f"[Helix] Layer 5: Loading layers from {layer_dir}")

    report = synthesize_all_layers(layer_dir)

    print(f"[Helix] Layer 5: Found {report['layer_2_memories']} emotional memories")
    print(f"[Helix] Layer 5: Found {report['layer_3_memories']} relational memories")
    print(f"[Helix] Layer 5: Found {report['layer_4_goals']} prospective goals")
    print(f"[Helix] Layer 5: Synthesized {len(report['synthesized_patterns'])} patterns")
    print(f"[Helix] Layer 5: Generated {len(report['recommended_actions'])} recommendations")
    print(f"[Helix] Layer 5: Synthesis confidence: {report['confidence']:.0%}")

    # Save report
    output_file = layer_dir / "synthesis_report.json"
    if save_synthesis_report(report, output_file):
        print(f"[Helix] Layer 5: Report saved to {output_file}")


if __name__ == "__main__":
    main()
