import { useSyncExternalStore } from "react";
import {
  renderModeStore,
  type RenderMode,
} from "../simulation/rendering/RenderModeStore";

/**
 * Developer render-mode toggle.
 */
export function RenderModeToggle() {
  const mode = useSyncExternalStore(
    renderModeStore.subscribe.bind(renderModeStore),
    renderModeStore.getSnapshot.bind(renderModeStore)
  );

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        zIndex: 101,
        background: "rgba(255,255,255,0.8)",
        color: "#000",
        fontFamily: "monospace",
        fontSize: 12,
        padding: 8,
      }}
    >
      <label>
        View:{" "}
        <select
          value={mode}
          onChange={(event) => renderModeStore.setMode(event.target.value as RenderMode)}
        >
          <option value="top">Top Tactical View</option>
          <option value="match">Match View</option>
        </select>
      </label>
    </div>
  );
}
