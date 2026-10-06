import { readFileSync } from "node:fs";
import path from "node:path";
import { strategyEntries } from "../index";

describe("strategy config contract", () => {
  it.each(strategyEntries)(
    "keeps decision costs explicit for $manifest.name",
    (entry) => {
      const config = entry.parseConfig({
        RISK_FEE_RATE: 0.002,
        RISK_SLIPPAGE_BPS: 15,
      });
      expect(config).toMatchObject({
        RISK_FEE_RATE: 0.002,
        RISK_SLIPPAGE_BPS: 15,
      });
      expect(() => entry.parseConfig({ SLIPPAGE_BASE_BPS: 10 })).toThrow(
        "SLIPPAGE_BASE_BPS",
      );
      expect(entry.defaults).not.toHaveProperty("FEE_PERCENT");
      expect(entry.defaults).not.toHaveProperty("SLIPPAGE_BASE_BPS");
      expect(() => entry.parseConfig({ FEE_PERCENT: 0.001 })).toThrow(
        "FEE_PERCENT",
      );
    },
  );

  it("uses the Project host for every TradeJS runtime dependency", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const runtimeDependencies = Object.keys(manifest.dependencies ?? {}).filter(
      (name) => name.startsWith("@tradejs/"),
    );
    const developmentRuntimePackages = Object.keys(
      manifest.devDependencies ?? {},
    ).filter((name) => name.startsWith("@tradejs/"));

    expect(runtimeDependencies).toEqual([]);
    expect(
      developmentRuntimePackages
        .filter(
          (name) =>
            name.startsWith("@tradejs/strategy-") &&
            name !== "@tradejs/strategy-kit",
        )
        .sort(),
    ).toEqual([
      "@tradejs/strategy-diamond",
      "@tradejs/strategy-flag",
      "@tradejs/strategy-gartley",
      "@tradejs/strategy-head-and-shoulders",
    ]);
    expect(
      developmentRuntimePackages.every((name) =>
        Object.hasOwn(manifest.peerDependencies ?? {}, name),
      ),
    ).toBe(true);
  });
});
