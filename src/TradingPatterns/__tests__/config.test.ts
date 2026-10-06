import { StrategyConfigValidationError } from "@tradejs/strategy-kit/config";
import {
  buildChildConfig,
  config,
  parseTradingPatternsConfig,
  type TradingPatternsConfig,
} from "../config";
import { PATTERN_NAMES, patternDefinitionByName } from "../patterns";

describe("TradingPatterns config", () => {
  it("keeps only the four selected detectors in their original relative order", () => {
    expect(PATTERN_NAMES).toEqual([
      "Diamond",
      "Flag",
      "Gartley",
      "HeadAndShoulders",
    ]);
    expect([...patternDefinitionByName.keys()]).toEqual(PATTERN_NAMES);
  });

  it.each([
    "Bat",
    "Crab",
    "CupAndHandle",
    "DoubleTap",
    "Dragon",
    "FiveZero",
    "Shark",
    "Triangle",
  ])(
    "rejects removed pattern %s rather than silently accepting its switch",
    (name) => {
      expect(() =>
        parseTradingPatternsConfig({
          TRADING_PATTERNS: { [name]: { enable: true } },
        }),
      ).toThrow();
      expect(() =>
        parseTradingPatternsConfig({
          TRADING_PATTERNS_PRIORITY: [...PATTERN_NAMES, name],
        }),
      ).toThrow();
    },
  );

  it("combines master switches and per-child floors without changing another child", () => {
    const parsed = parseTradingPatternsConfig({
      LONG: { enable: false },
      SHORT: { minRiskRatio: 1 },
      TRADING_PATTERNS: { Flag: { SHORT: { minRiskRatio: 1.6 } } },
    });
    const flag = buildChildConfig({
      pattern: patternDefinitionByName.get("Flag")!,
      config: parsed,
    });
    const gartley = buildChildConfig({
      pattern: patternDefinitionByName.get("Gartley")!,
      config: parsed,
    });
    expect(flag.LONG.enable).toBe(false);
    expect(flag.SHORT.minRiskRatio).toBe(1.6);
    expect(gartley.SHORT.minRiskRatio).toBe(1);
    expect(config.LONG.enable).toBe(true);
  });
  it("defaults to one hour and includes every supported pattern", () => {
    const parsed = parseTradingPatternsConfig({});

    expect(parsed).toEqual(config);
    expect(parsed.INTERVAL).toBe("60");
    expect(parsed.TRADING_PATTERNS_PRIORITY).toEqual(PATTERN_NAMES);
    expect(Object.keys(parsed.TRADING_PATTERNS)).toEqual(PATTERN_NAMES);
  });

  it("keeps a separate risk threshold for each pattern and direction", () => {
    const pattern = patternDefinitionByName.get("Diamond")!;
    const parsed = parseTradingPatternsConfig({
      TRADING_PATTERNS: {
        Diamond: {
          LONG: { minRiskRatio: 1.55 },
          SHORT: { minRiskRatio: 1.6 },
        },
      },
    });
    const child = buildChildConfig({ pattern, config: parsed }) as any;

    expect(child.LONG.minRiskRatio).toBe(1.55);
    expect(child.SHORT.minRiskRatio).toBe(1.6);
  });

  it("rejects any interval other than one hour", () => {
    expect(() => parseTradingPatternsConfig({ INTERVAL: "15" })).toThrow(
      "TradingPatterns.INTERVAL must be 60 (1h)",
    );
  });

  it("rejects incomplete, duplicate, and unknown priorities", () => {
    expect(() =>
      parseTradingPatternsConfig({
        TRADING_PATTERNS_PRIORITY: [
          ...PATTERN_NAMES.slice(0, -1),
          "UnknownPattern",
        ],
      }),
    ).toThrow(StrategyConfigValidationError);

    expect(() =>
      parseTradingPatternsConfig({
        TRADING_PATTERNS_PRIORITY: [
          PATTERN_NAMES[0],
          PATTERN_NAMES[0],
          ...PATTERN_NAMES.slice(2),
        ],
      }),
    ).toThrow("duplicate pattern Diamond");
  });

  it("requires at least one enabled detector", () => {
    const disabled = Object.fromEntries(
      PATTERN_NAMES.map((name) => [
        name,
        { ...config.TRADING_PATTERNS[name], enable: false },
      ]),
    ) as TradingPatternsConfig["TRADING_PATTERNS"];

    expect(() =>
      parseTradingPatternsConfig({ TRADING_PATTERNS: disabled }),
    ).toThrow("must enable at least one pattern");
  });

  it("rejects unknown fields", () => {
    expect(() =>
      parseTradingPatternsConfig({ UNKNOWN_STRATEGY_CONFIG_FIELD: true }),
    ).toThrow("TradingPatterns.UNKNOWN_STRATEGY_CONFIG_FIELD is not allowed");
  });
});
