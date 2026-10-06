import { DiamondStrategyDefinition } from "@tradejs/strategy-diamond";
import { FlagStrategyDefinition } from "@tradejs/strategy-flag";
import { GartleyStrategyDefinition } from "@tradejs/strategy-gartley";
import { HeadAndShouldersStrategyDefinition } from "@tradejs/strategy-head-and-shoulders";
import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";

export type TradingPatternName = (typeof patternDefinitions)[number]["name"];

export interface TradingPatternDefinition {
  name: TradingPatternName;
  code: string;
  definition: ValidatedStrategyRegistryEntry;
}

// Catalog order is the default priority. Names and definitions stay together.
export const patternDefinitions = [
  {
    name: "Diamond",
    code: "DIAMOND",
    definition: DiamondStrategyDefinition as ValidatedStrategyRegistryEntry,
  },
  {
    name: "Flag",
    code: "FLAG",
    definition: FlagStrategyDefinition as ValidatedStrategyRegistryEntry,
  },
  {
    name: "Gartley",
    code: "GARTLEY",
    definition: GartleyStrategyDefinition as ValidatedStrategyRegistryEntry,
  },
  {
    name: "HeadAndShoulders",
    code: "HEAD_AND_SHOULDERS",
    definition:
      HeadAndShouldersStrategyDefinition as ValidatedStrategyRegistryEntry,
  },
] as const;

export const PATTERN_NAMES: readonly TradingPatternName[] =
  patternDefinitions.map(({ name }) => name);

export const patternDefinitionByName = new Map<
  TradingPatternName,
  TradingPatternDefinition
>(patternDefinitions.map((pattern) => [pattern.name, pattern]));
