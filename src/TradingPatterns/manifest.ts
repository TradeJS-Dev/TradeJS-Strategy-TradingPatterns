import type { StrategyManifest } from "@tradejs/types";
import { tradingPatternsAiAdapter } from "./adapters";

export const tradingPatternsManifest: StrategyManifest = {
  name: "TradingPatterns",
  aiAdapter: tradingPatternsAiAdapter,
};
