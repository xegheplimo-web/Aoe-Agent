# Target Architecture — Aegis AoE1 Agent

The agent plays AoE1/RoR **as a human would**: it sees the screen, reasons about a
world model, and acts through guarded mouse/keyboard input. It is NOT a game-data
hack and NOT an LLM-per-frame system.

```
                 ┌───────────────┐
                 │  AoE1 window  │
                 └───────┬───────┘
                 Screen Capture (platform/)
                         ▼
               ┌──────────────────┐
               │ Perception       │  3 speeds: fast 10–20 Hz (focus, selection,
               │ hud/detector/map │  combat warn, skill verify) · medium 2–5 Hz
               └────────┬─────────┘  (units/buildings/resources) · slow ~1 Hz
                        ▼           (HUD numbers, age, economy)
                ┌──────────────┐
                │  WorldState  │  resources, population, entities, minimap,
                │  + spatial   │  known threats — the ONLY thing planners read
                │   memory     │
                └──────┬───────┘
          ┌────────────┴────────────┐
          ▼                         ▼
   Macro Planner              Tactical layer
   (build order + utility)    (combat/scout — later)
          └────────────┬────────────┘
                       ▼
              ┌─────────────────┐
              │  Skill Manager  │  ordered dispatch — seam for Behavior Tree
              └────────┬────────┘
                       ▼
             Verified Skill      preconditions → execute → verify → recover/abort
                       ▼
             Action Executor     press/click only through GameWindow guards
                       ▼
                     AoE1
```

## Layers

| Layer | Package | Owns |
|---|---|---|
| Platform | `aoe1/platform/` | Window find/focus, guarded capture + input, F9 safety, fingerprint |
| Perception | `aoe1/perception/` | HUD OCR, template UI checks → typed observations (never decisions) |
| World | `aoe1/world/` | `GameState` model + spatial memory (later: minimap, entity tracking) |
| Skills | `aoe1/skills/` | `Skill` contract + concrete skills (`TrainVillagerSkill`, …) + `SkillManager` |
| Runtime | `aoe1/runtime/` | `AgentRuntime` loop, `SessionPaths`, `ReplayEnvironment` |
| Telemetry | `aoe1/telemetry/` | `events.jsonl`, frames, run artifacts |
| Strategy | `aoe1/strategy/` | (later) build orders, BT, utility scoring |
| Data | `aoe1/data/` | (later) civs/units/buildings/tech tables |

## Skill Contract

Every capability is a `Skill`:

```
PRECONDITIONS  (observation must hold, debounced)
EXECUTE        (guarded input sequence)
EXPECTED       (state delta we expect)
VERIFY         (re-observe; confirm the delta)
TIMEOUT        (hard bound on verification)
RECOVERY       (reselect / reobserve)
ABORT          (UI mismatch, focus lost, anomalous delta)
```

Skills never touch pixel coordinates directly — they go through `GameWindow`
guards. Planners never read pixels — they read `GameState`.

## Rules

- **No LLM in the real-time loop.** If used later, an advisor may adjust strategic
  goals every 30–60 s — never per-frame, never emitting coordinates.
- **Fail-closed.** Unknown state ⇒ WAIT, never a guessed input (matches existing
  `EconomyPolicy` behavior).
- **Deterministic first.** RL/imitation replace small modules (combat micro,
  worker allocation) only after the deterministic bot completes matches.
- **Hotkeys over CV where possible** (TC key, control groups, idle-villager key)
  — shrinks the action space.
- **Replayable.** Everything between capture and decision must run offline on
  recorded frames (`ReplayEnvironment`) so agents/CI can develop without a game.

## Non-goals

- `.ai`/`.per` native game AI — different project (Project A).
- openage port — reference material only, not a runtime target.
