import { useSyncExternalStore } from "react";
import {
  developerOverlayStore,
  type DeveloperPlayerSnapshot,
  type SimulationSpeed,
} from "../simulation/devtools";

const SPEEDS: readonly SimulationSpeed[] = [0.25, 0.5, 1, 2, 4];

/**
 * Developer-only simulation overlay.
 */
export function DeveloperOverlay() {
  const snapshot = useSyncExternalStore(
    developerOverlayStore.subscribe.bind(developerOverlayStore),
    developerOverlayStore.getSnapshot.bind(developerOverlayStore)
  );
  const selectedPlayer = snapshot.players[0] ?? null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        zIndex: 100,
        background: "rgba(255,255,255,0.8)",
        color: "#000",
        fontFamily: "monospace",
        fontSize: 12,
        padding: 8,
        maxHeight: "100vh",
        overflow: "auto",
        pointerEvents: "auto",
      }}
    >
      <div>FPS: {snapshot.fps.toFixed(1)}</div>
      <div>
        Ball Coordinates: {formatVec(snapshot.ballPosition)}
      </div>
      <div>
        Ball Velocity: {formatVec(snapshot.ballVelocity)}
      </div>
      <div>Possession: {snapshot.possession.team} {snapshot.possession.playerId ?? ""}</div>
      <div>Current Match State: {snapshot.matchPhase}</div>
      <div>Match Time: {snapshot.displayTime}</div>
      <div>Score: Home {snapshot.score.home} - {snapshot.score.away} Away</div>

      <hr />

      <div>Selected Player: {selectedPlayer?.id ?? "None"}</div>
      {selectedPlayer ? <PlayerDebugRows player={selectedPlayer} /> : null}

      <hr />

      <button type="button" onClick={() => developerOverlayStore.pause()}>
        Pause
      </button>
      <button type="button" onClick={() => developerOverlayStore.resume()}>
        Resume
      </button>
      <button type="button" onClick={() => developerOverlayStore.frameAdvance()}>
        Frame Advance
      </button>

      <div>
        Simulation Speed:{" "}
        <select
          value={snapshot.controls.speed}
          onChange={(event) =>
            developerOverlayStore.setSpeed(Number(event.target.value) as SimulationSpeed)
          }
        >
          {SPEEDS.map((speed) => (
            <option key={speed} value={speed}>
              {speed}x
            </option>
          ))}
        </select>
      </div>
      <div>Paused: {snapshot.controls.paused ? "Yes" : "No"}</div>

      <hr />

      <details>
        <summary>All Player Coordinates</summary>
        {snapshot.players.map((player) => (
          <div key={player.id}>
            {player.id}: {formatVec(player.position)}
          </div>
        ))}
      </details>
    </div>
  );
}

function PlayerDebugRows({ player }: { player: DeveloperPlayerSnapshot }) {
  return (
    <>
      <div>Player Coordinates: {formatVec(player.position)}</div>
      <div>Current Tactical State: {player.tacticalState}</div>
      <div>Velocity: {formatVec(player.velocity)}</div>
      <div>Acceleration: {player.acceleration.toFixed(2)}</div>
    </>
  );
}

function formatVec(vector: { x: number; y: number }): string {
  return `(${vector.x.toFixed(2)}, ${vector.y.toFixed(2)})`;
}
