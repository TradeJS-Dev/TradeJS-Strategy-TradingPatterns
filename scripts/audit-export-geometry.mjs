import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { createInterface } from "node:readline";

const patterns = {
  DoubleTap: { contextKey: "doubleTapContext", pivots: 4 },
  Crab: { contextKey: "crabContext", pivots: 5 },
  Bat: { contextKey: "batContext", pivots: 5 },
  Triangle: { contextKey: "triangleContext", boundaryPivots: true },
  CupAndHandle: { contextKey: "cupAndHandleContext", pivots: 4 },
  Diamond: { contextKey: "diamondContext", pivots: 6 },
  Dragon: { contextKey: "dragonContext", pivots: 4 },
  FiveZero: { contextKey: "fiveZeroContext", pivots: 5 },
  Flag: { contextKey: "flagContext", boundaryPivots: true, pole: true },
  Gartley: { contextKey: "gartleyContext", pivots: 5 },
  HeadAndShoulders: { contextKey: "headAndShouldersContext", pivots: 5 },
  Shark: { contextKey: "sharkContext", pivots: 5 },
};

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const outputPath = outputIndex === -1 ? null : args[outputIndex + 1];
const files = args.filter(
  (value, index) =>
    value !== "--output" &&
    index !== outputIndex + 1 &&
    !value.startsWith("--"),
);

if (files.length === 0 || (outputIndex !== -1 && !outputPath)) {
  console.error(
    "Usage: yarn audit:geometry <dataset.jsonl...> [--output report.json]",
  );
  process.exit(2);
}

const isFinitePositive = (value) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const validTimedValue = (point, signalTimestamp) =>
  isRecord(point) &&
  Number.isFinite(point.timestamp) &&
  point.timestamp <= signalTimestamp &&
  isFinitePositive(point.value);

const validPivot = (pivot, signalTimestamp) =>
  validTimedValue(pivot, signalTimestamp) &&
  (pivot.kind === "high" || pivot.kind === "low");

const orderedPivots = (pivots, signalTimestamp) =>
  Array.isArray(pivots) &&
  pivots.every((pivot) => validPivot(pivot, signalTimestamp)) &&
  pivots.every(
    (pivot, index) =>
      index === 0 || pivot.timestamp > pivots[index - 1].timestamp,
  );

const validFigurePoint = (point) =>
  isRecord(point) &&
  Number.isFinite(point.timestamp) &&
  isFinitePositive(point.value);

const validateFigures = (figures) => {
  if (!isRecord(figures)) return "missing figures";
  const lines = Array.isArray(figures.lines) ? figures.lines : [];
  const points = Array.isArray(figures.points) ? figures.points : [];
  if (lines.length === 0) return "missing geometry lines";
  if (points.length === 0) return "missing geometry points";

  for (const figure of [...lines, ...points]) {
    if (!isRecord(figure) || typeof figure.kind !== "string") {
      return "figure has no kind";
    }
    if (!Array.isArray(figure.points) || figure.points.length === 0) {
      return `empty figure ${String(figure.kind)}`;
    }
    if (!figure.points.every(validFigurePoint)) {
      return `non-finite figure point in ${String(figure.kind)}`;
    }
  }
  if (lines.some((line) => line.points.length < 2)) {
    return "geometry line has fewer than two points";
  }
  return null;
};

const validateDirectionPrices = ({
  direction,
  currentPrice,
  targetPrice,
  stop,
}) => {
  if (![currentPrice, targetPrice, stop].every(isFinitePositive)) {
    return "entry, target or stop is not finite and positive";
  }
  if (
    direction === "LONG" &&
    !(targetPrice > currentPrice && stop < currentPrice)
  ) {
    return "LONG target/stop is on the wrong side of entry";
  }
  if (
    direction === "SHORT" &&
    !(targetPrice < currentPrice && stop > currentPrice)
  ) {
    return "SHORT target/stop is on the wrong side of entry";
  }
  if (direction !== "LONG" && direction !== "SHORT") {
    return "unknown direction";
  }
  return null;
};

const report = {
  schema: "tradejs-trading-patterns-geometry-audit/v1",
  files,
  rows: 0,
  validRows: 0,
  invalidRows: 0,
  minTimestamp: null,
  maxTimestamp: null,
  patterns: Object.fromEntries(
    Object.keys(patterns).map((name) => [name, { rows: 0, invalidRows: 0 }]),
  ),
  issues: {},
  samples: [],
};

const addIssue = ({ issue, row, pattern }) => {
  report.invalidRows += 1;
  report.patterns[pattern].invalidRows += 1;
  report.issues[issue] = (report.issues[issue] ?? 0) + 1;
  if (report.samples.length < 100) {
    report.samples.push({
      issue,
      pattern,
      signalId: row.signalId ?? null,
      symbol: row.symbol ?? null,
      timestamp: row.timestamp ?? null,
    });
  }
};

for (const file of files) {
  const input = createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  });
  let lineNumber = 0;
  for await (const line of input) {
    lineNumber += 1;
    if (!line.trim()) continue;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      report.rows += 1;
      report.invalidRows += 1;
      const issue = "invalid JSON row";
      report.issues[issue] = (report.issues[issue] ?? 0) + 1;
      if (report.samples.length < 100) {
        report.samples.push({ issue, file, lineNumber });
      }
      continue;
    }

    report.rows += 1;
    const signalTimestamp = row.timestamp;
    if (Number.isFinite(signalTimestamp)) {
      report.minTimestamp = Math.min(
        report.minTimestamp ?? signalTimestamp,
        signalTimestamp,
      );
      report.maxTimestamp = Math.max(
        report.maxTimestamp ?? signalTimestamp,
        signalTimestamp,
      );
    }

    const payload = isRecord(row.payload) ? row.payload : {};
    const additional = isRecord(payload.additionalIndicators)
      ? payload.additionalIndicators
      : {};
    const selectedPattern = additional.tradingPatternsContext?.selectedPattern;
    const definition = patterns[selectedPattern];
    if (!definition) {
      report.invalidRows += 1;
      const issue = "missing or unknown selectedPattern";
      report.issues[issue] = (report.issues[issue] ?? 0) + 1;
      continue;
    }

    report.patterns[selectedPattern].rows += 1;
    const context = additional[definition.contextKey];
    let issue = null;
    if (!isRecord(context)) {
      issue = `missing ${definition.contextKey}`;
    } else if (typeof context.setupId !== "string" || !context.setupId) {
      issue = "missing setupId";
    } else if (context.signalDirection !== row.direction) {
      issue = "context direction differs from row direction";
    } else if (!Number.isFinite(signalTimestamp)) {
      issue = "invalid signal timestamp";
    } else if (definition.pivots) {
      if (
        !orderedPivots(context.pivots, signalTimestamp) ||
        context.pivots.length !== definition.pivots
      ) {
        issue = `invalid ${selectedPattern} pivot sequence`;
      }
    } else if (definition.boundaryPivots) {
      if (
        !orderedPivots(context.upperPivots, signalTimestamp) ||
        !orderedPivots(context.lowerPivots, signalTimestamp) ||
        context.upperPivots.length < 2 ||
        context.lowerPivots.length < 2
      ) {
        issue = `invalid ${selectedPattern} boundary pivots`;
      }
    }

    if (!issue && definition.pole) {
      if (
        !validTimedValue(context.pole?.start, signalTimestamp) ||
        !validTimedValue(context.pole?.end, signalTimestamp) ||
        context.pole.start.timestamp >= context.pole.end.timestamp
      ) {
        issue = "invalid Flag pole";
      }
    }

    const prices = payload.signal?.prices ?? {};
    issue ??= validateDirectionPrices({
      direction: row.direction,
      currentPrice: prices.currentPrice,
      targetPrice: prices.takeProfitPrice,
      stop: prices.stopLossPrice,
    });
    issue ??= validateFigures(payload.figures);

    if (issue) addIssue({ issue, row, pattern: selectedPattern });
    else {
      report.validRows += 1;
    }
  }
}

report.coveredPatterns = Object.entries(report.patterns)
  .filter(([, value]) => value.rows > 0)
  .map(([name]) => name);
report.missingPatterns = Object.entries(report.patterns)
  .filter(([, value]) => value.rows === 0)
  .map(([name]) => name);
report.minTimestampIso = report.minTimestamp
  ? new Date(report.minTimestamp).toISOString()
  : null;
report.maxTimestampIso = report.maxTimestamp
  ? new Date(report.maxTimestamp).toISOString()
  : null;

const json = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) await writeFile(outputPath, json);
process.stdout.write(json);
if (report.invalidRows > 0 || report.missingPatterns.length > 0)
  process.exit(1);
