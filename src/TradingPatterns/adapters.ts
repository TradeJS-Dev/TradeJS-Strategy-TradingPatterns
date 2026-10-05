import { mapAiRuntimeFromConfig } from "@tradejs/core/strategies";
import {
  getAiPayloadNumber,
  withStrategyLocalAiGate,
} from "@tradejs/strategy-kit/ai-gate";
import type { AiPayload, Signal, StrategyAiAdapter } from "@tradejs/types";
import type { TradingPatternsConfig } from "./config";
import { patternDefinitionByName, type TradingPatternName } from "./patterns";

const getSelectedPattern = (
  additionalIndicators: unknown,
): TradingPatternName | undefined => {
  const additional =
    (additionalIndicators as Record<string, unknown> | undefined) ?? {};
  const context =
    (additional.tradingPatternsContext as
      Record<string, unknown> | undefined) ?? {};
  const selected = context.selectedPattern;

  return typeof selected === "string" &&
    patternDefinitionByName.has(selected as TradingPatternName)
    ? (selected as TradingPatternName)
    : undefined;
};

const getSourceAdapter = ({
  signal,
  payload,
}: {
  signal: Signal;
  payload?: AiPayload;
}) => {
  const selectedPattern =
    getSelectedPattern(signal.additionalIndicators) ??
    getSelectedPattern(payload?.additionalIndicators);
  return selectedPattern
    ? patternDefinitionByName.get(selectedPattern)?.definition.manifest
        .aiAdapter
    : undefined;
};

const shortReplacementGate = withStrategyLocalAiGate(
  {},
  {
    id: "trading_patterns_short_D_protected_flag_economics_2026_10_05",
    approves: ({ signal, payload }) => {
      if (signal.direction !== "SHORT") return false;

      const nearestSupportDistanceAtr = getAiPayloadNumber(
        payload,
        "additionalIndicators.baseContext.structure.srZones.nearestSupport.distanceAtr",
      );
      const maStackScore = getAiPayloadNumber(
        payload,
        "additionalIndicators.baseContext.regime.trend.maStackScore",
      );
      const trailDistancePct = getAiPayloadNumber(
        payload,
        "additionalIndicators.baseContext.regime.trend.trendFollow.distanceToTrailStopPct",
      );
      const passesD =
        (nearestSupportDistanceAtr != null &&
          Number.isFinite(nearestSupportDistanceAtr) &&
          nearestSupportDistanceAtr <= 0.7 &&
          maStackScore != null &&
          Number.isFinite(maStackScore) &&
          maStackScore <= 0) ||
        (trailDistancePct != null &&
          Number.isFinite(trailDistancePct) &&
          trailDistancePct >= -1.3);
      if (!passesD) return false;

      // Match the frozen research rule's payload source-pattern predicate.
      if (getSelectedPattern(payload.additionalIndicators) !== "Flag")
        return true;
      const grossRiskRatio = getAiPayloadNumber(
        payload,
        "additionalIndicators.flagContext.executionEconomics.grossRiskRatio",
      );
      const priceDistanceToMaFastAtr = getAiPayloadNumber(
        payload,
        "additionalIndicators.baseContext.regime.trend.priceDistanceToMaFastAtr",
      );
      return (
        (grossRiskRatio != null &&
          Number.isFinite(grossRiskRatio) &&
          grossRiskRatio > 3) ||
        (priceDistanceToMaFastAtr != null &&
          Number.isFinite(priceDistanceToMaFastAtr) &&
          priceDistanceToMaFastAtr > 0.4)
      );
    },
  },
);

export const tradingPatternsAiAdapter: StrategyAiAdapter = {
  buildPayload: ({ signal, basePayload }) => {
    const sourceAdapter = getSourceAdapter({ signal, payload: basePayload });
    return (
      sourceAdapter?.buildPayload?.({ signal, basePayload }) ?? basePayload
    );
  },
  buildSystemPromptAddon: ({ signal }) =>
    getSourceAdapter({ signal })?.buildSystemPromptAddon?.({ signal }) ?? "",
  buildHumanPromptAddon: ({ signal, payload }) => {
    const additional =
      (payload.additionalIndicators as Record<string, unknown> | undefined) ??
      {};
    const context =
      (additional.tradingPatternsContext as
        Record<string, unknown> | undefined) ?? {};

    const sourceAddon =
      getSourceAdapter({ signal, payload })?.buildHumanPromptAddon?.({
        signal,
        payload,
      }) ?? "";

    return `
Additional TradingPatterns context:
- selectedPattern=${String(context.selectedPattern ?? "n/a")}
- sourceCode=${String(context.sourceCode ?? "n/a")}

Interpret the geometry fields supplied by the selected source pattern. Do not
mix rules from other pattern families into this signal.

${sourceAddon}
`.trim();
  },
  postProcessAnalysis: ({ signal, payload, analysis }) =>
    getSourceAdapter({ signal, payload })?.postProcessAnalysis?.({
      signal,
      payload,
      analysis,
    }) ?? analysis,
  postProcessLocalAnalysis: ({ signal, payload, analysis }) => {
    if (signal.direction === "SHORT") {
      return (
        shortReplacementGate.postProcessLocalAnalysis?.({
          signal,
          payload,
          analysis,
        }) ?? analysis
      );
    }

    return (
      getSourceAdapter({ signal, payload })?.postProcessLocalAnalysis?.({
        signal,
        payload,
        analysis,
      }) ?? analysis
    );
  },
  mapEntryRuntimeFromConfig: (config) =>
    mapAiRuntimeFromConfig(
      config as Pick<
        TradingPatternsConfig,
        "AI_ENABLED" | "AI_MODE" | "MIN_AI_QUALITY"
      >,
    ),
};
