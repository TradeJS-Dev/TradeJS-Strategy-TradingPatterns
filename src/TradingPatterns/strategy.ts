import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";
import {
  config as DEFAULT_CONFIG,
  parseTradingPatternsConfig,
  type TradingPatternsConfig,
} from "./config";
import { createTradingPatternsCore } from "./core";
import { tradingPatternsManifest } from "./manifest";

export const TradingPatternsStrategyDefinition: ValidatedStrategyRegistryEntry<TradingPatternsConfig> =
  {
    defaults: DEFAULT_CONFIG,
    parseConfig: parseTradingPatternsConfig,
    createCore: createTradingPatternsCore,
    manifest: tradingPatternsManifest,
  };
