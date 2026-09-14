import type { ValidatedStrategyRegistryEntry } from "@tradejs/strategy-kit/config";
import type {
  Direction,
  Position,
  StrategyAPI,
  StrategyConfig,
} from "@tradejs/types";
import {
  config as DEFAULT_CONFIG,
  type TradingPatternsConfig,
} from "../config";
import {
  createTradingPatternsCore,
  createTradingPatternsCoreWithDefinitions,
} from "../core";
import type { TradingPatternDefinition, TradingPatternName } from "../patterns";

const makeConfig = (
  enabled: readonly TradingPatternName[],
): TradingPatternsConfig => ({
  ...DEFAULT_CONFIG,
  TRADING_PATTERNS: Object.fromEntries(
    Object.entries(DEFAULT_CONFIG.TRADING_PATTERNS).map(([name, value]) => [
      name,
      { ...value, enable: enabled.includes(name as TradingPatternName) },
    ]),
  ) as TradingPatternsConfig["TRADING_PATTERNS"],
});

const makeDefinition = ({
  name,
  code,
  events,
  enter = true,
  exit = true,
}: {
  name: TradingPatternName;
  code: string;
  events: string[];
  enter?: boolean;
  exit?: boolean;
}): TradingPatternDefinition => {
  const defaults: StrategyConfig = {
    INTERVAL: "15",
    MAX_LOSS_VALUE: 10,
    LONG: { enable: true, direction: "LONG", minRiskRatio: 0.7 },
    SHORT: { enable: true, direction: "SHORT", minRiskRatio: 0.7 },
  };
  const definition: ValidatedStrategyRegistryEntry = {
    defaults,
    manifest: { name },
    parseConfig: (input) => ({ ...defaults, ...(input as StrategyConfig) }),
    createCore: async ({ strategyApi }) => {
      const lastTrade = strategyApi.createLastTradeController();
      return async (candle) => {
        events.push(`${name}:${candle.timestamp}`);
        const position = await strategyApi.getCurrentPosition();
        if (position) {
          return exit
            ? strategyApi.exit({
                code: `${code}_EXIT`,
                direction: position.direction,
              })
            : strategyApi.skip(`${code}_HOLD`);
        }
        if (!enter) return strategyApi.skip(`${code}_NO_PATTERN`);

        lastTrade.markTrade(candle.timestamp);
        return strategyApi.entry({
          code: `${code}_ENTRY`,
          direction: "LONG",
          additionalIndicators: { [`${name}Context`]: { detected: true } },
          orderPlan: {
            qty: 1,
            stopLossPrice: 90,
            takeProfits: [{ rate: 1, price: 120 }],
          },
        });
      };
    },
  };

  return { name, code, definition };
};

const makeStateController = () => {
  const states = new Map<string, unknown>();
  return <TState>(key: string, createState: () => TState) => {
    if (!states.has(key)) states.set(key, createState());
    return {
      get: () => states.get(key) as TState,
      set: (state: TState) => states.set(key, state),
      update: (update: (state: TState) => void) => {
        const state = states.get(key) as TState;
        update(state);
        return state;
      },
      oncePerTimestamp: (
        _timestamp: number,
        compute: (state: TState) => unknown,
      ) => compute(states.get(key) as TState),
      snapshot: () => states.get(key) as TState,
      hash: () => JSON.stringify(states.get(key)),
    };
  };
};

const makeStrategyApi = () => {
  let position: Position | null = null;
  const committedTrades: number[] = [];
  const api = {
    skip: (code: string) => ({ kind: "skip", code }),
    entry: jest.fn(async (params: any) => ({
      kind: "entry",
      code: params.code,
      entryContext: {
        strategy: "TradingPatterns",
        symbol: "TESTUSDT",
        interval: "60",
        direction: params.direction,
        timestamp: 1,
        prices: {
          currentPrice: 100,
          stopLossPrice: params.orderPlan.stopLossPrice,
          takeProfitPrice: params.orderPlan.takeProfits[0].price,
          riskRatio: 2,
        },
      },
      orderPlan: params.orderPlan,
    })),
    exit: jest.fn(async (params: any) => ({
      kind: "exit",
      code: params.code,
      closePlan: { direction: params.direction, price: 100, timestamp: 1 },
    })),
    protect: jest.fn((params: any) => ({
      kind: "protect",
      code: params.code,
      protectPlan: params.protectPlan,
    })),
    getCurrentIndicatorsContext: jest.fn(),
    getBaseContext: jest.fn(),
    getDecisionBaseContext: jest.fn(),
    getDecisionPriceContext: jest.fn(),
    getCurrentPosition: jest.fn(async () => position),
    getDirectionalTpSlPrices: jest.fn(),
    createLastTradeController: jest.fn(() => ({
      isInCooldown: () => false,
      markTrade: (timestamp: number) => committedTrades.push(timestamp),
      getLastTradeTimestamp: () => null,
    })),
    createStateController: makeStateController(),
  } as unknown as StrategyAPI;

  return {
    api,
    committedTrades,
    setPosition: (next: Position | null) => {
      position = next;
    },
  };
};

const indicatorsState = {} as any;
const candle = {
  timestamp: 1,
  open: 100,
  high: 101,
  low: 99,
  close: 100,
} as any;

describe("TradingPatterns core", () => {
  it("initializes every real pattern package in one runtime", async () => {
    const { api } = makeStrategyApi();
    const core = await createTradingPatternsCore({
      config: DEFAULT_CONFIG,
      data: [],
      strategyApi: api,
      indicatorsState,
    });

    const decision = await core(candle, candle);

    expect(decision).toEqual({
      kind: "skip",
      code: "TRADING_PATTERNS_NO_PATTERN",
    });
    expect(api.createLastTradeController).toHaveBeenCalledTimes(12);
  });

  it("updates every detector but emits only the highest-priority entry", async () => {
    const events: string[] = [];
    const definitions = [
      makeDefinition({ name: "DoubleTap", code: "DOUBLE_TAP", events }),
      makeDefinition({ name: "Crab", code: "CRAB", events }),
    ];
    const { api, committedTrades } = makeStrategyApi();
    const core = await createTradingPatternsCoreWithDefinitions(definitions)({
      config: makeConfig(["DoubleTap", "Crab"]),
      data: [],
      strategyApi: api,
      indicatorsState,
    });

    const decision = await core(candle, candle);

    expect(events).toEqual(["DoubleTap:1", "Crab:1"]);
    expect(decision).toMatchObject({
      kind: "entry",
      code: "TRADING_PATTERNS_DOUBLE_TAP_DOUBLE_TAP_ENTRY",
    });
    expect((api.entry as jest.Mock).mock.calls[0][0]).toMatchObject({
      additionalIndicators: {
        DoubleTapContext: { detected: true },
        tradingPatternsContext: {
          selectedPattern: "DoubleTap",
          sourceCode: "DOUBLE_TAP_ENTRY",
        },
      },
    });
    expect(api.entry).toHaveBeenCalledTimes(1);
    expect(committedTrades).toEqual([1]);
  });

  it("lets only the pattern that opened the position issue an early exit", async () => {
    const events: string[] = [];
    const definitions = [
      makeDefinition({ name: "DoubleTap", code: "DOUBLE_TAP", events }),
      makeDefinition({ name: "Crab", code: "CRAB", events }),
    ];
    const runtime = makeStrategyApi();
    const core = await createTradingPatternsCoreWithDefinitions(definitions)({
      config: makeConfig(["DoubleTap", "Crab"]),
      data: [],
      strategyApi: runtime.api,
      indicatorsState,
    });

    await core(candle, candle);
    runtime.setPosition({
      symbol: "TESTUSDT",
      qty: 1,
      price: 100,
      direction: "LONG" as Direction,
    });
    const exitDecision = await core({ ...candle, timestamp: 2 }, candle);

    expect(exitDecision).toMatchObject({
      kind: "exit",
      code: "TRADING_PATTERNS_DOUBLE_TAP_DOUBLE_TAP_EXIT",
    });
    expect(runtime.api.exit).toHaveBeenCalledTimes(1);
    expect(runtime.committedTrades).toEqual([1]);
  });

  it("does not initialize disabled pattern runtimes", async () => {
    const events: string[] = [];
    const definitions = [
      makeDefinition({ name: "DoubleTap", code: "DOUBLE_TAP", events }),
      makeDefinition({ name: "Crab", code: "CRAB", events }),
    ];
    const { api } = makeStrategyApi();
    const core = await createTradingPatternsCoreWithDefinitions(definitions)({
      config: makeConfig(["Crab"]),
      data: [],
      strategyApi: api,
      indicatorsState,
    });

    const decision = await core(candle, candle);

    expect(events).toEqual(["Crab:1"]);
    expect(decision).toMatchObject({
      kind: "entry",
      code: "TRADING_PATTERNS_CRAB_CRAB_ENTRY",
    });
  });
});
