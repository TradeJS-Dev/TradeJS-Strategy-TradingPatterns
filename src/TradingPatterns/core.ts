import type {
  CreateStrategyCore,
  Position,
  StrategyAPI,
  StrategyAPIEntryParams,
  StrategyAPIExitParams,
  StrategyAPIProtectParams,
  StrategyDecision,
  StrategyLastTradeController,
  StrategyLastTradeControllerParams,
} from "@tradejs/types";
import { buildChildConfig, type TradingPatternsConfig } from "./config";
import {
  patternDefinitionByName,
  patternDefinitions,
  type TradingPatternDefinition,
  type TradingPatternName,
} from "./patterns";

type EntryDecision = Extract<StrategyDecision, { kind: "entry" }>;
type ExitDecision = Extract<StrategyDecision, { kind: "exit" }>;
type ProtectDecision = Extract<StrategyDecision, { kind: "protect" }>;

interface CapturedCalls {
  entry?: StrategyAPIEntryParams;
  exit?: StrategyAPIExitParams;
  protect?: StrategyAPIProtectParams;
}

interface StagedLastTradeController {
  controller: StrategyLastTradeController;
  pendingTimestamp: number | null;
}

interface PatternRuntime {
  pattern: TradingPatternDefinition;
  capture: CapturedCalls;
  stagedControllers: StagedLastTradeController[];
  setVisiblePosition: (position: Position | null) => void;
  runner: Awaited<
    ReturnType<TradingPatternDefinition["definition"]["createCore"]>
  >;
}

interface TradingPatternsState {
  activePattern: TradingPatternName | null;
}

const asCapturedEntryDecision = (
  params: StrategyAPIEntryParams,
): EntryDecision => ({
  kind: "entry",
  code: params.code ?? "CAPTURED_ENTRY",
  entryContext: {} as EntryDecision["entryContext"],
  orderPlan: params.orderPlan,
  runtime: params.runtime,
});

const asCapturedExitDecision = (
  params: StrategyAPIExitParams,
): ExitDecision => ({
  kind: "exit",
  code: params.code ?? "CAPTURED_EXIT",
  closePlan: {} as ExitDecision["closePlan"],
});

const asCapturedProtectDecision = (
  params: StrategyAPIProtectParams,
): ProtectDecision => ({
  kind: "protect",
  code: params.code ?? "CAPTURED_PROTECT",
  protectPlan: params.protectPlan,
});

const createCapturingApi = ({
  strategyApi,
  capture,
  stagedControllers,
}: {
  strategyApi: StrategyAPI<any>;
  capture: CapturedCalls;
  stagedControllers: StagedLastTradeController[];
}) => {
  let visiblePosition: Position | null = null;

  const api: StrategyAPI<any> = {
    ...strategyApi,
    entry: async (params) => {
      capture.entry = params;
      return asCapturedEntryDecision(params);
    },
    exit: async (params) => {
      capture.exit = params;
      return asCapturedExitDecision(params);
    },
    protect: (params) => {
      capture.protect = params;
      return asCapturedProtectDecision(params);
    },
    getCurrentPosition: async () => visiblePosition,
    createLastTradeController: (params?: StrategyLastTradeControllerParams) => {
      const delegate = strategyApi.createLastTradeController(params);
      const staged: StagedLastTradeController = {
        controller: delegate,
        pendingTimestamp: null,
      };
      stagedControllers.push(staged);

      return {
        isInCooldown: delegate.isInCooldown,
        getLastTradeTimestamp: delegate.getLastTradeTimestamp,
        markTrade: (timestamp) => {
          staged.pendingTimestamp = timestamp;
        },
      };
    },
  };

  return {
    api,
    setVisiblePosition: (position: Position | null) => {
      visiblePosition = position;
    },
  };
};

const resetRuntimeCapture = (runtime: PatternRuntime) => {
  delete runtime.capture.entry;
  delete runtime.capture.exit;
  delete runtime.capture.protect;
  runtime.stagedControllers.forEach((staged) => {
    staged.pendingTimestamp = null;
  });
};

const commitStagedTrade = (runtime: PatternRuntime) => {
  runtime.stagedControllers.forEach((staged) => {
    if (staged.pendingTimestamp !== null) {
      staged.controller.markTrade(staged.pendingTimestamp);
      staged.pendingTimestamp = null;
    }
  });
};

const codeFor = (
  pattern: TradingPatternDefinition,
  sourceCode: string | undefined,
) => `TRADING_PATTERNS_${pattern.code}_${sourceCode ?? "DECISION"}`;

export const createTradingPatternsCoreWithDefinitions =
  (
    definitions: readonly TradingPatternDefinition[],
  ): CreateStrategyCore<TradingPatternsConfig> =>
  async ({ config, data, strategyApi, indicatorsState }) => {
    const ownership = strategyApi.createStateController<TradingPatternsState>(
      "TradingPatterns",
      () => ({ activePattern: null }),
      {
        configKey: JSON.stringify({
          priority: config.TRADING_PATTERNS_PRIORITY,
          enabled: config.TRADING_PATTERNS,
        }),
      },
    );

    const runtimes: PatternRuntime[] = [];
    for (const patternName of config.TRADING_PATTERNS_PRIORITY) {
      const pattern = definitions.find((item) => item.name === patternName);
      if (!pattern || !config.TRADING_PATTERNS[pattern.name].enable) continue;

      const capture: CapturedCalls = {};
      const stagedControllers: StagedLastTradeController[] = [];
      const { api, setVisiblePosition } = createCapturingApi({
        strategyApi,
        capture,
        stagedControllers,
      });
      const runner = await pattern.definition.createCore({
        config: buildChildConfig({ pattern, config }),
        data,
        strategyApi: api,
        indicatorsState,
      });

      runtimes.push({
        pattern,
        capture,
        stagedControllers,
        setVisiblePosition,
        runner,
      });
    }

    return async (candle, btcCandle) => {
      const currentPosition = await strategyApi.getCurrentPosition();
      const state = ownership.get();
      if (!currentPosition && state.activePattern !== null) {
        ownership.update((current) => {
          current.activePattern = null;
        });
      }

      let selectedEntry: PatternRuntime | undefined;
      let selectedExit: PatternRuntime | undefined;
      let selectedProtect: PatternRuntime | undefined;

      for (const runtime of runtimes) {
        resetRuntimeCapture(runtime);
        const ownsPosition =
          currentPosition !== null &&
          ownership.get().activePattern === runtime.pattern.name;
        runtime.setVisiblePosition(ownsPosition ? currentPosition : null);

        await runtime.runner(candle, btcCandle);

        if (!currentPosition && !selectedEntry && runtime.capture.entry) {
          selectedEntry = runtime;
        }
        if (ownsPosition && !selectedExit && runtime.capture.exit) {
          selectedExit = runtime;
        }
        if (ownsPosition && !selectedProtect && runtime.capture.protect) {
          selectedProtect = runtime;
        }
      }

      if (currentPosition) {
        if (selectedExit?.capture.exit) {
          ownership.update((current) => {
            current.activePattern = null;
          });
          return strategyApi.exit({
            ...selectedExit.capture.exit,
            code: codeFor(selectedExit.pattern, selectedExit.capture.exit.code),
          });
        }
        if (selectedProtect?.capture.protect) {
          return strategyApi.protect({
            ...selectedProtect.capture.protect,
            code: codeFor(
              selectedProtect.pattern,
              selectedProtect.capture.protect.code,
            ),
          });
        }
        return strategyApi.skip("TRADING_PATTERNS_POSITION_EXISTS");
      }

      if (!selectedEntry?.capture.entry) {
        return strategyApi.skip("TRADING_PATTERNS_NO_PATTERN");
      }

      commitStagedTrade(selectedEntry);
      ownership.update((current) => {
        current.activePattern = selectedEntry.pattern.name;
      });

      const sourceEntry = selectedEntry.capture.entry;
      return strategyApi.entry({
        ...sourceEntry,
        code: codeFor(selectedEntry.pattern, sourceEntry.code),
        additionalIndicators: {
          ...(sourceEntry.additionalIndicators ?? {}),
          tradingPatternsContext: {
            selectedPattern: selectedEntry.pattern.name,
            sourceCode: sourceEntry.code ?? null,
          },
        },
      });
    };
  };

export const createTradingPatternsCore =
  createTradingPatternsCoreWithDefinitions(patternDefinitions);

export const getTradingPatternDefinition = (name: TradingPatternName) =>
  patternDefinitionByName.get(name);
