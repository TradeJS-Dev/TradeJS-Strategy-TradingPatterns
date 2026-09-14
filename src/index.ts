import { defineStrategyPlugin } from "@tradejs/core/config";
import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";
import type { StrategyConfig } from "@tradejs/types";
import { config as tradingPatternsDefaultConfig } from "./TradingPatterns/config";
import { TradingPatternsStrategyDefinition } from "./TradingPatterns/strategy";

export const strategyEntries: ValidatedStrategyRegistryEntry<any>[] = [
  TradingPatternsStrategyDefinition,
];

const defaultConfigs: Record<string, StrategyConfig> = {
  TradingPatterns: tradingPatternsDefaultConfig,
};

export const getBuiltInStrategyDefaultConfig = (
  strategyName: string,
): StrategyConfig | undefined => defaultConfigs[strategyName];

export * from "./TradingPatterns/index";
export { tradingPatternsDefaultConfig };

export default defineStrategyPlugin({ strategyEntries });
