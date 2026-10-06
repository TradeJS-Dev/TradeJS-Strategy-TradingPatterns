# @tradejs/strategy-trading-patterns

TradeJS strategy plugin providing `TradingPatterns` on the fixed `1h`
timeframe (`INTERVAL: "60"`).

## Included patterns

- `Diamond`
- `Flag`
- `Gartley`
- `HeadAndShoulders`

Every detector is evaluated on every candle so its replay state stays current.
When several patterns signal on the same candle, `TRADING_PATTERNS_PRIORITY`
selects one decision. The default order is the list above. The selected child
keeps ownership of the position and is the only child allowed to request an
early pattern exit. Stop-loss and take-profit handling remains with TradeJS.

The package imports each detector through its public strategy package. Pattern
geometry, risk plans, figures, and AI context therefore stay owned by their
source packages instead of being copied into this repository.

Disabled patterns and Bat were removed from the composition. Existing configs
must remove their toggle entries, priority entries and pattern-specific fields.
The parser rejects removed patterns rather than silently ignoring them.
The standalone child packages are unchanged by this composition cleanup.

## Install

```bash
yarn add @tradejs/strategy-trading-patterns \
  @tradejs/strategy-diamond \
  @tradejs/strategy-flag \
  @tradejs/strategy-gartley \
  @tradejs/strategy-head-and-shoulders
```

Register the package in `tradejs.config.ts`:

```ts
import { defineConfig } from "@tradejs/core/config";

export default defineConfig({
  strategies: ["@tradejs/strategy-trading-patterns"],
});
```

All detectors are enabled by default. The default directional switches from
their source packages are preserved. For example, the current
`HeadAndShoulders` default keeps its experimental inverse direction disabled.

```ts
{
  TradingPatterns: {
    INTERVAL: "60",
    TRADING_PATTERNS: {
      Diamond: {
        enable: true,
        LONG: { enable: true, minRiskRatio: 1.15 },
        SHORT: { enable: true, minRiskRatio: 1.15 }
      },
      Flag: {
        enable: true,
        LONG: { enable: true, minRiskRatio: 0.7 },
        SHORT: { enable: true, minRiskRatio: 0.5 }
      }
      // Other pattern entries are materialized from defaults.
    }
  }
}
```

Pattern-specific fields keep their existing names, such as
`DIAMOND_PIVOT_LENGTH`, `FLAG_PIVOT_RADIUS`, and
`GARTLEY_MIN_AD_RETRACEMENT_RATIO`. They can be tuned in the same `TradingPatterns`
config without changing the composition code.

Top-level `LONG.enable` and `SHORT.enable` are master switches. Their
`minRiskRatio` values are optional common floors; the default floor is `0`, so
each pattern's own directional threshold remains authoritative.

## Development

```bash
yarn install --immutable
yarn checks
```

## Runtime host contract

All `@tradejs/*` runtime packages are peer dependencies. The consuming TradeJS
Project owns their exact installed versions and package manifest, so this
package never loads hidden nested framework or strategy copies.
