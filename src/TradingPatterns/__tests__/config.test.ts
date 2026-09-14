import { StrategyConfigValidationError } from "@tradejs/strategy-kit/config";
import {
  config,
  parseTradingPatternsConfig,
  type TradingPatternsConfig,
} from "../config";
import { PATTERN_NAMES } from "../patterns";

describe("TradingPatterns config", () => {
  it("defaults to one hour and includes every supported pattern", () => {
    const parsed = parseTradingPatternsConfig({});

    expect(parsed).toEqual(config);
    expect(parsed.INTERVAL).toBe("60");
    expect(parsed.TRADING_PATTERNS_PRIORITY).toEqual(PATTERN_NAMES);
    expect(Object.keys(parsed.TRADING_PATTERNS)).toEqual(PATTERN_NAMES);
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
    ).toThrow("duplicate pattern DoubleTap");
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
