import { BatStrategyDefinition } from "@tradejs/strategy-bat";
import { CrabStrategyDefinition } from "@tradejs/strategy-crab";
import { CupAndHandleStrategyDefinition } from "@tradejs/strategy-cup-and-handle";
import { DiamondStrategyDefinition } from "@tradejs/strategy-diamond";
import { DoubleTapStrategyDefinition } from "@tradejs/strategy-double-tap";
import { DragonStrategyDefinition } from "@tradejs/strategy-dragon";
import { FiveZeroStrategyDefinition } from "@tradejs/strategy-five-zero";
import { FlagStrategyDefinition } from "@tradejs/strategy-flag";
import { GartleyStrategyDefinition } from "@tradejs/strategy-gartley";
import { HeadAndShouldersStrategyDefinition } from "@tradejs/strategy-head-and-shoulders";
import { SharkStrategyDefinition } from "@tradejs/strategy-shark";
import { TriangleStrategyDefinition } from "@tradejs/strategy-triangle";
import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";

export const PATTERN_NAMES = [
  "DoubleTap",
  "Crab",
  "Bat",
  "Triangle",
  "CupAndHandle",
  "Diamond",
  "Dragon",
  "FiveZero",
  "Flag",
  "Gartley",
  "HeadAndShoulders",
  "Shark",
] as const;

export type TradingPatternName = (typeof PATTERN_NAMES)[number];

export interface TradingPatternDefinition {
  name: TradingPatternName;
  code: string;
  definition: ValidatedStrategyRegistryEntry;
}

export const patternDefinitions: readonly TradingPatternDefinition[] = [
  {
    name: "DoubleTap",
    code: "DOUBLE_TAP",
    definition: DoubleTapStrategyDefinition,
  },
  { name: "Crab", code: "CRAB", definition: CrabStrategyDefinition },
  { name: "Bat", code: "BAT", definition: BatStrategyDefinition },
  {
    name: "Triangle",
    code: "TRIANGLE",
    definition: TriangleStrategyDefinition,
  },
  {
    name: "CupAndHandle",
    code: "CUP_AND_HANDLE",
    definition: CupAndHandleStrategyDefinition,
  },
  {
    name: "Diamond",
    code: "DIAMOND",
    definition: DiamondStrategyDefinition,
  },
  {
    name: "Dragon",
    code: "DRAGON",
    definition: DragonStrategyDefinition,
  },
  {
    name: "FiveZero",
    code: "FIVE_ZERO",
    definition: FiveZeroStrategyDefinition,
  },
  { name: "Flag", code: "FLAG", definition: FlagStrategyDefinition },
  {
    name: "Gartley",
    code: "GARTLEY",
    definition: GartleyStrategyDefinition,
  },
  {
    name: "HeadAndShoulders",
    code: "HEAD_AND_SHOULDERS",
    definition: HeadAndShouldersStrategyDefinition,
  },
  { name: "Shark", code: "SHARK", definition: SharkStrategyDefinition },
];

export const patternDefinitionByName = new Map(
  patternDefinitions.map((pattern) => [pattern.name, pattern]),
);
