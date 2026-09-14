import type { AiPayload, Signal } from "@tradejs/types";
import { tradingPatternsAiAdapter } from "../adapters";

describe("TradingPatterns AI adapter", () => {
  it("delegates interpretation context to the selected pattern adapter", () => {
    const signal = {
      strategy: "TradingPatterns",
      additionalIndicators: {
        tradingPatternsContext: {
          selectedPattern: "Bat",
          sourceCode: "BAT_BULLISH_D_CONFIRMED",
        },
        batContext: { patternKind: "bullish_bat" },
      },
    } as unknown as Signal;
    const payload = {
      signal,
      additionalIndicators: signal.additionalIndicators,
    } as unknown as AiPayload;

    const addon = tradingPatternsAiAdapter.buildHumanPromptAddon?.({
      signal,
      payload,
    });

    expect(addon).toContain("selectedPattern=Bat");
    expect(addon).toContain("Additional Bat context");
    expect(addon).toContain("patternKind=bullish_bat");
  });

  it("approves a SHORT near support in a non-bullish MA stack", () => {
    const signal = {
      strategy: "TradingPatterns",
      direction: "SHORT",
      prices: {
        currentPrice: 100,
        takeProfitPrice: 90,
        stopLossPrice: 105,
      },
      additionalIndicators: {
        tradingPatternsContext: { selectedPattern: "Flag" },
      },
    } as unknown as Signal;
    const payload = {
      signal,
      additionalIndicators: {
        tradingPatternsContext: { selectedPattern: "Flag" },
        baseContext: {
          structure: {
            srZones: { nearestSupport: { distanceAtr: 0.7 } },
          },
          regime: { trend: { maStackScore: 0 } },
        },
      },
    } as unknown as AiPayload;

    const result = tradingPatternsAiAdapter.postProcessLocalAnalysis?.({
      signal,
      payload,
      analysis: { direction: null, quality: 3 },
    });

    expect(result).toEqual(
      expect.objectContaining({
        approved: true,
        direction: "SHORT",
        quality: 4,
        gateDecision: "approved",
      }),
    );
    expect((result as any).qualityReason).toContain(
      "trading_patterns_short_near_support_070_nonbull_stack_2026_09_14",
    );
  });

  it("rejects a SHORT when causal gate inputs are missing", () => {
    const signal = {
      strategy: "TradingPatterns",
      direction: "SHORT",
      prices: {
        currentPrice: 100,
        takeProfitPrice: 90,
        stopLossPrice: 105,
      },
      additionalIndicators: {
        tradingPatternsContext: { selectedPattern: "Flag" },
      },
    } as unknown as Signal;
    const payload = {
      signal,
      additionalIndicators: {
        tradingPatternsContext: { selectedPattern: "Flag" },
        baseContext: {},
      },
    } as unknown as AiPayload;

    const result = tradingPatternsAiAdapter.postProcessLocalAnalysis?.({
      signal,
      payload,
      analysis: { direction: "SHORT", quality: 4 },
    });

    expect(result).toEqual(
      expect.objectContaining({
        approved: false,
        direction: null,
        quality: 3,
        gateDecision: "rejected",
      }),
    );
  });

  it("keeps the selected child gate authoritative for LONG", () => {
    const signal = {
      strategy: "TradingPatterns",
      direction: "LONG",
      prices: {
        currentPrice: 100,
        takeProfitPrice: 110,
        stopLossPrice: 95,
      },
      additionalIndicators: {
        tradingPatternsContext: { selectedPattern: "Bat" },
      },
    } as unknown as Signal;
    const payload = {
      signal,
      additionalIndicators: signal.additionalIndicators,
    } as unknown as AiPayload;
    const analysis = {
      direction: "LONG" as const,
      quality: 4,
      approved: true,
    };

    const result = tradingPatternsAiAdapter.postProcessLocalAnalysis?.({
      signal,
      payload,
      analysis,
    });

    expect(result).toEqual(analysis);
  });
});
