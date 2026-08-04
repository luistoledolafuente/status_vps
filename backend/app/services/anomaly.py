"""Anomaly score: statistical deviation (z-score) vs. the recent baseline.

Compares the current CPU, memory and load readings against their behavior
over the last N minutes. A score of 0 means "behaves as usual"; higher
scores mean the server is behaving unusually for its own baseline — the
idea popularized by Netdata, implemented here with plain statistics.
"""

import math
from statistics import mean, pstdev
from typing import Optional


def _z_score(value: float, baseline: list[float]) -> float:
    if len(baseline) < 2:
        return 0.0
    average = mean(baseline)
    deviation = pstdev(baseline)
    if deviation < 1e-9:
        return 0.0
    return max(0.0, (value - average) / deviation)


def _clamp_to_hundred(value: float) -> float:
    return max(0.0, min(100.0, value / 4.0 * 100.0))


def _level(score: float) -> str:
    if score < 40:
        return "normal"
    if score < 60:
        return "elevated"
    if score < 80:
        return "high"
    return "critical"


class AnomalyScorer:
    def __init__(self, window_minutes: int = 120, critical: float = 80.0):
        self.window_minutes = window_minutes
        self.critical = critical

    def score(
        self,
        cpu_percent: float,
        memory_percent: float,
        load_one_min: Optional[float],
        history_points: list[dict],
    ) -> dict:
        """Returns the anomaly report for the current sample."""
        cpu_baseline = [p.get("cpu_percent", 0) for p in history_points]
        mem_baseline = [p.get("memory_percent", 0) for p in history_points]
        load_baseline = [p.get("load_one_min") for p in history_points if p.get("load_one_min") is not None]

        metrics: dict[str, float] = {"cpu": _clamp_to_hundred(_z_score(cpu_percent, cpu_baseline))}
        metrics["memory"] = _clamp_to_hundred(_z_score(memory_percent, mem_baseline))
        if load_one_min is not None and load_baseline:
            metrics["load"] = _clamp_to_hundred(_z_score(load_one_min, load_baseline))

        weights = {"cpu": 0.4, "memory": 0.3, "load": 0.3}
        weight_sum = sum(weights[k] for k in metrics)
        score = (
            sum(weights[k] * metrics[k] for k in metrics) / weight_sum
            if weight_sum > 0
            else 0.0
        )
        return {
            "score": round(score, 1),
            "level": _level(score),
            "critical_threshold": self.critical,
            "metrics": {k: round(v, 1) for k, v in metrics.items()},
        }
