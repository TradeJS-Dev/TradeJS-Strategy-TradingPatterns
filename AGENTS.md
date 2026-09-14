# AGENTS.md

## Scope

These rules apply to this complete strategy repository.

## Workspace Routing

- The canonical workspace map is `~/dev/tradejs/AGENTS.md`.
- Make `TradingPatterns` composition, configuration, adapters, and tests here;
  run `yarn checks` here.
- Make source detector changes in the standalone package that owns that pattern.
- Run backtests, replay, Redis, evidence, notes, and release operations from
  `~/dev/tradejs/tradejs-project`. Keep that directory as `PROJECT_CWD` and
  point `TRADEJS_SOURCE_REPOSITORY_ROOT` at this repository for lineage.
- Use `$strategy-backtest-research` for implementation and backtest work.
- Do not create `data/`, `notes/`, runtime config, or deployment files here.

## Ownership

This repository owns the `TradingPatterns` one-hour composition policy. The
individual strategy packages continue to own their detector mechanics, risk
plans, figures, and pattern-specific AI context.

## Architecture

- Export the TradeJS plugin contract through `strategyEntries`.
- Import child strategies only through their public package roots.
- Evaluate every enabled child detector on each candle so replay state remains
  complete and bounded.
- Emit at most one decision per candle according to
  `TRADING_PATTERNS_PRIORITY`.
- Track which child opened the position and let only that child issue an early
  exit or protection decision. Exchange stop-loss and take-profit handling
  remains unchanged.
- Keep `INTERVAL` fixed at `60`.
- Keep StrategyAPI side effects in `core.ts`.

## Verification

Run `yarn checks` before every commit.

## Runtime Dependency Contract

- Keep every `@tradejs/*` runtime package in both `peerDependencies` and
  `devDependencies`, never in `dependencies`.
- The consuming TradeJS Project must own the exact runtime composition; nested
  TradeJS package copies are forbidden.
- Keep the package dependency contract covered by tests.
