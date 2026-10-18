/**
 * v1 (browser store) vs engine on the same boards.
 *
 *   npm run bench -w @football/engine
 */
import { Bench } from "tinybench";
import { BoardAnalysis, summarizeSequence } from "../src/index.ts";
import { GameStateStore } from "../test/legacy/GameStateStore.legacy.ts";
import { loadSequence } from "../test/helpers.ts";

const board = loadSequence("Arg_vs_france.json")[0];
const longSequence = loadSequence("vlc1.game_states.json");

function legacyStore(state: unknown) {
  const store = new GameStateStore();
  store.importFromJsonString(JSON.stringify(state));
  return store;
}

const single = new Bench({ name: "single board, all layers", time: 2000, warmupTime: 500 });
single
  .add("v1 store", () => {
    const store = legacyStore(board);
    store.getZoneInfluenceResult();
    store.getExploitabilityResult();
    store.getPassingAnalysisResult();
    store.getRunningChannelsResult();
    store.getOverloadAnalysisResult();
  })
  .add("engine", () => {
    new BoardAnalysis(board).compute();
  });

const sequence = new Bench({ name: `report telemetry, ${longSequence.length}-board perception sequence`, time: 5000, iterations: 5 });
sequence
  .add("v1 store", () => {
    legacyStore({ type: "ScenarioSequence", id: "bench", name: "bench", boards: longSequence }).getTacticalAnalysisPayload("sequence");
  })
  .add("engine", () => {
    summarizeSequence(longSequence);
  });

for (const b of [single, sequence]) {
  await b.run();
  console.log(`\n${b.name}`);
  console.table(b.table());
}
