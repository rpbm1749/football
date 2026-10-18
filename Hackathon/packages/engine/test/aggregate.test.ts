import { describe, expect, it } from "vitest";
import { aggregateFrames, summarizeSequence } from "../src/index.ts";
import { calculateAverageMetrics } from "./legacy/calculateAverageMetrics.legacy.ts";
import { loadSequence } from "./helpers.ts";

describe("sequence aggregate matches v1's report dashboard maths", () => {
  it.each(["Arg_vs_france.json", "sequence1.json", "vlc1.json", "vlc.game_states.json", "testing1.json"])("%s", (file) => {
    const payload = summarizeSequence(loadSequence(file));
    expect(aggregateFrames(payload.frames)).toEqual(calculateAverageMetrics(payload));
  });

  it("returns null for an empty sequence", () => {
    expect(aggregateFrames([])).toBeNull();
  });
});
