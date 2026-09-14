import {
  createCostIsolatedStrategyConfigParser,
  StrategyConfigValidationError,
} from "@tradejs/strategy-kit/config";
import type { Direction, StrategyConfig } from "@tradejs/types";
import {
  PATTERN_NAMES,
  patternDefinitions,
  type TradingPatternDefinition,
  type TradingPatternName,
} from "./patterns";

export interface TradingPatternsSideConfig {
  enable: boolean;
  direction: Direction;
  minRiskRatio: number;
}

export interface TradingPatternDirectionConfig {
  enable: boolean;
  minRiskRatio: number;
}

export interface TradingPatternToggle {
  enable: boolean;
  LONG: TradingPatternDirectionConfig;
  SHORT: TradingPatternDirectionConfig;
}

export type TradingPatternToggles = Record<
  TradingPatternName,
  TradingPatternToggle
>;

export interface TradingPatternsConfig extends StrategyConfig {
  INTERVAL: "60";
  AI_ENABLED: boolean;
  AI_MODE: "gate" | "llm";
  MIN_AI_QUALITY: number;
  TRADING_PATTERNS_PRIORITY: TradingPatternName[];
  TRADING_PATTERNS: TradingPatternToggles;
  LONG: TradingPatternsSideConfig;
  SHORT: TradingPatternsSideConfig;
  [key: string]: unknown;
}

const cloneValue = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(cloneValue) as T;
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, cloneValue(nested)]),
    ) as T;
  }
  return value;
};

const serialized = (value: unknown) => JSON.stringify(value);

const mergePatternDefaults = (): Record<string, unknown> => {
  const merged: Record<string, unknown> = {};
  const ownerByKey = new Map<string, TradingPatternName>();

  for (const pattern of patternDefinitions) {
    for (const [key, value] of Object.entries(pattern.definition.defaults)) {
      if (key === "INTERVAL" || key === "LONG" || key === "SHORT") continue;

      if (key in merged && serialized(merged[key]) !== serialized(value)) {
        const firstOwner = ownerByKey.get(key);
        throw new Error(
          `Conflicting default ${key} in ${String(firstOwner)} and ${pattern.name}`,
        );
      }

      merged[key] = cloneValue(value);
      ownerByKey.set(key, pattern.name);
    }
  }

  return merged;
};

const referenceSides = patternDefinitions[0]!.definition.defaults as Record<
  string,
  unknown
>;
const patternDefaults = mergePatternDefaults();

const createPatternToggles = (): TradingPatternToggles =>
  Object.fromEntries(
    patternDefinitions.map(({ name, definition }) => {
      const defaults = definition.defaults as Record<string, unknown>;
      const long = defaults.LONG as
        { enable?: unknown; minRiskRatio?: unknown } | undefined;
      const short = defaults.SHORT as
        { enable?: unknown; minRiskRatio?: unknown } | undefined;

      return [
        name,
        {
          enable: true,
          LONG: {
            enable: long?.enable !== false,
            minRiskRatio: Number(long?.minRiskRatio ?? 0.7),
          },
          SHORT: {
            enable: short?.enable !== false,
            minRiskRatio: Number(short?.minRiskRatio ?? 0.7),
          },
        },
      ];
    }),
  ) as unknown as TradingPatternToggles;

export const config: TradingPatternsConfig = {
  ...patternDefaults,
  INTERVAL: "60",
  AI_ENABLED: patternDefaults.AI_ENABLED as boolean,
  AI_MODE: patternDefaults.AI_MODE as "gate" | "llm",
  MIN_AI_QUALITY: patternDefaults.MIN_AI_QUALITY as number,
  TRADING_PATTERNS_PRIORITY: [...PATTERN_NAMES],
  TRADING_PATTERNS: createPatternToggles(),
  LONG: {
    ...(cloneValue(referenceSides.LONG) as TradingPatternsSideConfig),
    minRiskRatio: 0,
  },
  SHORT: {
    ...(cloneValue(referenceSides.SHORT) as TradingPatternsSideConfig),
    minRiskRatio: 0,
  },
};

const baseParseConfig = createCostIsolatedStrategyConfigParser({
  strategyName: "TradingPatterns",
  defaults: config,
});

const validatePriority = (
  priority: readonly TradingPatternName[],
): string[] => {
  const issues: string[] = [];
  const known = new Set<string>(PATTERN_NAMES);
  const received = new Set<string>();

  priority.forEach((name, index) => {
    if (!known.has(name)) {
      issues.push(
        `TradingPatterns.TRADING_PATTERNS_PRIORITY[${index}] contains unknown pattern ${String(name)}`,
      );
    }
    if (received.has(name)) {
      issues.push(
        `TradingPatterns.TRADING_PATTERNS_PRIORITY contains duplicate pattern ${String(name)}`,
      );
    }
    received.add(name);
  });

  for (const name of PATTERN_NAMES) {
    if (!received.has(name)) {
      issues.push(
        `TradingPatterns.TRADING_PATTERNS_PRIORITY is missing pattern ${name}`,
      );
    }
  }

  return issues;
};

export const parseTradingPatternsConfig = (
  input: unknown,
): TradingPatternsConfig => {
  const parsed = baseParseConfig(input);
  const issues = validatePriority(parsed.TRADING_PATTERNS_PRIORITY);

  if (parsed.INTERVAL !== "60") {
    issues.push("TradingPatterns.INTERVAL must be 60 (1h)");
  }

  if (
    !Object.values(parsed.TRADING_PATTERNS).some((pattern) => pattern.enable)
  ) {
    issues.push(
      "TradingPatterns.TRADING_PATTERNS must enable at least one pattern",
    );
  }

  if (issues.length > 0) {
    throw new StrategyConfigValidationError("TradingPatterns", issues);
  }

  return parsed;
};

const buildSideConfig = ({
  direction,
  definition,
  config: tradingPatternsConfig,
  toggle,
}: {
  direction: "LONG" | "SHORT";
  definition: TradingPatternDefinition["definition"];
  config: TradingPatternsConfig;
  toggle: TradingPatternToggle;
}) => {
  const defaults = definition.defaults as Record<string, unknown>;
  const defaultSide = defaults[direction] as Record<string, unknown>;
  const sharedSide = tradingPatternsConfig[direction];

  return {
    ...defaultSide,
    ...sharedSide,
    enable: sharedSide.enable && toggle[direction].enable,
    minRiskRatio: Math.max(
      sharedSide.minRiskRatio,
      toggle[direction].minRiskRatio,
    ),
    direction,
  };
};

export const buildChildConfig = ({
  pattern,
  config: tradingPatternsConfig,
}: {
  pattern: TradingPatternDefinition;
  config: TradingPatternsConfig;
}): StrategyConfig => {
  const toggle = tradingPatternsConfig.TRADING_PATTERNS[pattern.name];
  const input = Object.fromEntries(
    Object.keys(pattern.definition.defaults).map((key) => {
      if (key === "INTERVAL") return [key, "60"];
      if (key === "LONG") {
        return [
          key,
          buildSideConfig({
            direction: "LONG",
            definition: pattern.definition,
            config: tradingPatternsConfig,
            toggle,
          }),
        ];
      }
      if (key === "SHORT") {
        return [
          key,
          buildSideConfig({
            direction: "SHORT",
            definition: pattern.definition,
            config: tradingPatternsConfig,
            toggle,
          }),
        ];
      }
      return [key, tradingPatternsConfig[key]];
    }),
  );

  return pattern.definition.parseConfig(input);
};
