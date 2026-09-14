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
});
