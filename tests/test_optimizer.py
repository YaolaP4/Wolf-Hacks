"""Exactness tests: the tree DP must match brute-force enumeration on random forests."""
import random
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "pipeline"))
from optimizer import Node, brute_force, evaluate, objective, solve  # noqa: E402


def random_forest(rng: random.Random, n: int) -> dict:
    nodes = {}
    for i in range(n):
        parent = None
        if i > 0 and rng.random() < 0.7:
            parent = f"n{rng.randrange(i)}"
        nodes[f"n{i}"] = Node(
            id=f"n{i}",
            parent=parent,
            habitat=round(rng.uniform(0, 10), 3),
            flood=round(rng.uniform(0, 1), 3),
            cost=rng.randint(1, 6),
            # anchors: sometimes uncapped, sometimes a cap tight enough to bind
            anchor=None if parent is not None or rng.random() < 0.3 else round(rng.uniform(0, 25), 3),
        )
    return nodes


@pytest.mark.parametrize("seed", range(300))
def test_dp_matches_brute_force(seed):
    rng = random.Random(seed)
    nodes = random_forest(rng, rng.randint(1, 11))
    lam = rng.choice([0.0, 0.0, 0.3, 0.7, 1.0])
    budget = rng.randint(0, 25)
    sol = solve(nodes, budget, lam)
    expected = brute_force(nodes, budget, lam)
    assert sol.best[budget] == pytest.approx(expected, abs=1e-9)
    plan = sol.plan(budget)
    assert evaluate(nodes, plan)["cost_units"] <= budget
    assert objective(nodes, plan, lam) == pytest.approx(expected, abs=1e-9)


def test_best_is_monotone_in_budget():
    rng = random.Random(7)
    nodes = random_forest(rng, 40)
    sol = solve(nodes, 120, 0.0)
    assert all(b2 >= b1 - 1e-12 for b1, b2 in zip(sol.best, sol.best[1:]))


def test_upper_culvert_worthless_without_lower():
    nodes = {
        "low": Node("low", None, habitat=1.0, flood=0.0, cost=5, anchor=100.0),
        "high": Node("high", "low", habitat=50.0, flood=0.0, cost=5),
    }
    assert evaluate(nodes, ["high"])["habitat_miles"] == 0.0
    assert evaluate(nodes, ["high", "low"])["habitat_miles"] == 51.0
    sol = solve(nodes, 10, 0.0)
    assert sorted(sol.plan(10)) == ["high", "low"]


def test_single_culvert_matches_inventory_gain():
    # one culvert: gain is min(upstream, downstream), the inventory's own definition
    nodes = {"a": Node("a", None, habitat=11.7, flood=0.0, cost=3, anchor=0.4)}
    assert evaluate(nodes, ["a"])["habitat_miles"] == 0.4


def test_large_uncapped_tree_uses_dp():
    rng = random.Random(3)
    nodes = random_forest(rng, 60)
    for n in nodes.values():
        n.anchor = None if n.parent else 1e9
    sol = solve(nodes, 80, 0.4)
    plan = sol.plan(80)
    assert objective(nodes, plan, 0.4) == pytest.approx(sol.best[80], abs=1e-9)
