# Roadmap — from scenario harness to real AoE1 bot

Assessment baseline (2026-10): working safety/verification foundation for exactly
one skill — observe HUD → train one villager → confirm population +1 — plus a
review dashboard. Functionality ≈ 5–10% of "plays a match"; technical foundation
≈ 30–35%.

## Phases

| Phase | Deliverable (gate)                                                                                |
| ----- | ------------------------------------------------------------------------------------------------- |
| P0    | CI green on `main` — DONE                                                                         |
| P1    | Runtime architecture: layered packages, Skill contract, `TrainVillagerSkill`, `ReplayEnvironment` |
| P2    | HUD perception stability (custom digit reader optional; Tesseract stays fallback)                 |
| P3    | `BUILD_HOUSE` verified end-to-end in scenario                                                     |
| P4    | `GATHER_FOOD` / `GATHER_WOOD` verified                                                            |
| P5    | Minimap parser + spatial memory (`MinimapCoord`/`WorldEstimate`)                                  |
| P6    | Autonomous Stone-Age economy loop (no idle villagers, pop-block handled)                          |
| P7    | Stone → Tool autonomous                                                                           |
| P8    | Barracks + `TRAIN_MILITARY` + control groups                                                      |
| P9    | Scout + enemy location                                                                            |
| P10   | Attack/defend (threshold attack → priority targets → retreat)                                     |
| P11   | Deterministic full-match bot                                                                      |
| P12   | Multiple civilizations / build orders                                                             |
| P13   | Imitation learning from self-recorded human play                                                  |
| P14   | RL scoped to micro modules (combat, worker allocation, timing)                                    |
| P15   | Self-play / evaluation league                                                                     |

## Skill sequence (P1→P8)

1. `TRAIN_VILLAGER` (exists) · 2. `SELECT_VILLAGER` · 3. `BUILD_HOUSE` ·
2. `GATHER_FOOD` · 5. `GATHER_WOOD` · 6. `BUILD_STORAGE_PIT` · 7. `BUILD_GRANARY` ·
3. `SCOUT` · 9. `BUILD_BARRACKS` · 10. `ADVANCE_AGE` · 11. `TRAIN_MILITARY` ·
4. `FORM_ARMY` · 13. `ATTACK_MOVE` · 14. `RETREAT` · 15. `EXPAND_ECONOMY`

## Milestones

- **M1** — autonomous Stone → Tool, success ≥ 90% across repeated random-map runs.
- **M2** — complete-match survival ≥ 95% (no stuck states / crashes).
- **M3** — win-rate tracked on the 100-game benchmark.

## Final acceptance — "bot done" means benchmarked

100 random-map games, one civilization, zero human input after start, measuring:

`startup success · Stone→Tool · Tool→Bronze · idle-economy time · population-block
time · villager uptime · resource utilization · enemy-discovery time ·
army-creation time · first-attack time · win rate · crashes · invalid clicks ·
stuck states · recovery rate`

## Standing decisions

- Dashboard is **frozen** — effort goes to `aoe1/`, `tests/`, `datasets/` until
  Stone→Tool is autonomous.
- Tesseract is prototype-grade; the HUD's fixed font/positions justify a small
  digit recognizer later (ms-level reads). Tesseract remains fallback/debug.
- AoE's hotkeys (H for TC, control groups, idle-villager) are preferred over
  screen search wherever they exist.
- `run.py --live` remains a HUMAN-gated action.
