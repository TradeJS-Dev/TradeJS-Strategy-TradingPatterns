import type { AiPayload, Signal } from "@tradejs/types";
import { tradingPatternsAiAdapter } from "../adapters";

const evaluate = ({
  support,
  stack,
  trail,
  rr,
  fast,
  pattern = "Flag",
  direction = "SHORT",
}: {
  support?: unknown;
  stack?: unknown;
  trail?: unknown;
  rr?: unknown;
  fast?: unknown;
  pattern?: string;
  direction?: string;
}):
  { approved?: boolean; direction?: unknown; quality?: number } | undefined => {
  const signal = {
    strategy: "TradingPatterns",
    direction,
    prices: { currentPrice: 100, takeProfitPrice: 90, stopLossPrice: 105 },
    additionalIndicators: {
      tradingPatternsContext: { selectedPattern: pattern },
    },
  } as unknown as Signal;
  const payload = {
    signal,
    additionalIndicators: {
      tradingPatternsContext: { selectedPattern: pattern },
      flagContext: { executionEconomics: { grossRiskRatio: rr } },
      baseContext: {
        structure: { srZones: { nearestSupport: { distanceAtr: support } } },
        regime: {
          trend: {
            maStackScore: stack,
            trendFollow: { distanceToTrailStopPct: trail },
            priceDistanceToMaFastAtr: fast,
          },
        },
      },
    },
  } as unknown as AiPayload;
  return tradingPatternsAiAdapter.postProcessLocalAnalysis?.({
    signal,
    payload,
    analysis: { direction: null, quality: 3 },
  });
};

describe("selected frozen SHORT gate", () => {
  it.each([
    [0.7, 0, true],
    [0.7000001, 0, false],
    [0.7, 0.000001, false],
  ])(
    "keeps D support/stack inclusive boundaries",
    (support, stack, approved) => {
      expect(evaluate({ support, stack, rr: 3.1 })?.approved).toBe(approved);
    },
  );
  it.each([
    [-1.3, true],
    [-1.300001, false],
  ])("keeps D trail inclusive boundary", (trail, approved) => {
    expect(evaluate({ trail, rr: 3.1 })?.approved).toBe(approved);
  });
  it.each([
    [3, 0.4, false],
    [3.000001, 0.4, true],
    [3, 0.400001, true],
  ])("keeps Flag protection strict OR boundaries", (rr, fast, approved) => {
    expect(evaluate({ trail: -1.3, rr, fast })?.approved).toBe(approved);
  });
  it.each([undefined, null, NaN, Infinity, -Infinity])(
    "rejects missing/non-finite D and Flag inputs",
    (value) => {
      expect(
        evaluate({ support: value, stack: value, trail: value, rr: 4 })
          ?.approved,
      ).toBe(false);
      expect(evaluate({ trail: -1.3, rr: value, fast: value })?.approved).toBe(
        false,
      );
    },
  );
  it("allows the other valid OR branch when one Flag feature is missing", () => {
    expect(evaluate({ trail: -1.3, rr: null, fast: 0.5 })?.approved).toBe(true);
    expect(evaluate({ trail: -1.3, rr: 4, fast: NaN })?.approved).toBe(true);
  });
  it.each(["Diamond", "Gartley", "HeadAndShoulders"])(
    "does not apply Flag-only protection to %s",
    (pattern) => {
      expect(evaluate({ trail: -1.3, pattern })?.approved).toBe(true);
    },
  );
  it("does not rescue Flag when D fails", () => {
    expect(
      evaluate({ support: 1, stack: 1, trail: -2, rr: 4, fast: 1 })?.approved,
    ).toBe(false);
  });
  it("assigns exact quality4 and SHORT direction on approval", () => {
    expect(evaluate({ trail: -1.3, rr: 4 })).toEqual(
      expect.objectContaining({
        approved: true,
        quality: 4,
        direction: "SHORT",
      }),
    );
  });
  it("delegates LONG to its existing child gate", () => {
    expect(
      evaluate({ pattern: "Diamond", direction: "LONG", trail: -1.3, rr: 4 }),
    ).toEqual(
      expect.objectContaining({
        direction: null,
        quality: 3,
        qualityReason: expect.stringContaining(
          "diamond_h1_psar_take_profit_directional_gate",
        ),
      }),
    );
  });
});
