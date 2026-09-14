# @tradejs/strategy-trading-patterns

TradeJS strategy plugin providing `TradingPatterns` on the fixed `1h`
timeframe (`INTERVAL: "60"`).

## Included patterns

- `DoubleTap`
- `Crab`
- `Bat`
- `Triangle`
- `CupAndHandle`
- `Diamond`
- `Dragon`
- `FiveZero`
- `Flag`
- `Gartley`
- `HeadAndShoulders`
- `Shark`

Every detector is evaluated on every candle so its replay state stays current.
When several patterns signal on the same candle, `TRADING_PATTERNS_PRIORITY`
selects one decision. The default order is the list above. The selected child
keeps ownership of the position and is the only child allowed to request an
early pattern exit. Stop-loss and take-profit handling remains with TradeJS.

The package imports each detector through its public strategy package. Pattern
geometry, risk plans, figures, and AI context therefore stay owned by their
source packages instead of being copied into this repository.

## Install

```bash
yarn add @tradejs/strategy-trading-patterns \
  @tradejs/strategy-double-tap \
  @tradejs/strategy-crab \
  @tradejs/strategy-bat \
  @tradejs/strategy-triangle \
  @tradejs/strategy-cup-and-handle \
  @tradejs/strategy-diamond \
  @tradejs/strategy-dragon \
  @tradejs/strategy-five-zero \
  @tradejs/strategy-flag \
  @tradejs/strategy-gartley \
  @tradejs/strategy-head-and-shoulders \
  @tradejs/strategy-shark
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
      DoubleTap: { enable: true, LONG: true, SHORT: true },
      Crab: { enable: true, LONG: true, SHORT: true }
      // Other pattern entries are materialized from defaults.
    }
  }
}
```

Pattern-specific fields keep their existing names, such as
`DOUBLETAP_PIVOT_LENGTH`, `BAT_XD_RETRACEMENT`, and
`TRIANGLE_MIN_PATTERN_BARS`. They can be tuned in the same `TradingPatterns`
config without changing the composition code.

## Development

```bash
yarn install --immutable
yarn checks
```

## Runtime host contract

All `@tradejs/*` runtime packages are peer dependencies. The consuming TradeJS
Project owns their exact installed versions and package manifest, so this
package never loads hidden nested framework or strategy copies.
