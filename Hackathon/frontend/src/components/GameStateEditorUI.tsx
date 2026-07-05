import React, { useSyncExternalStore, useEffect, useState } from "react";
import { gameStateStore } from "../simulation/rendering/GameStateStore";

export function GameStateEditorUI() {
  const state = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getSnapshot.bind(gameStateStore)
  );

  const editMode = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getEditMode.bind(gameStateStore)
  );

  const selectedScenarioName = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getSelectedScenarioName.bind(gameStateStore)
  );

  const scenariosList = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getScenariosList.bind(gameStateStore)
  );

  const selectedPlayerId = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getSelectedPlayerId.bind(gameStateStore)
  );

  const isDirty = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getIsDirty.bind(gameStateStore)
  );



  const isLoading = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getIsLoading.bind(gameStateStore)
  );

  // Tab State
  const [activeTab, setActiveTab] = useState<"editor" | "builder">("editor");

  // Save As modal/state
  const [saveAsName, setSaveAsName] = useState("");
  const [showSaveAs, setShowSaveAs] = useState(false);

  // Load scenarios on mount & inject spinner keyframes
  useEffect(() => {
    gameStateStore.fetchScenariosList();
    const styleEl = document.createElement("style");
    styleEl.innerHTML = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styleEl);
    return () => {
      document.head.removeChild(styleEl);
    };
  }, []);

  const selectedPlayer = state.players.find(p => p.id === selectedPlayerId) || null;

  // Handles JSON upload
  const handleJsonImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        const success = gameStateStore.importFromJsonString(result);
        if (success) {
          alert("GameState imported successfully!");
        } else {
          alert("Failed to import. Invalid GameState structure.");
        }
      }
    };
    reader.readAsText(file);
  };

  // Triggers JSON download
  const handleJsonExport = () => {
    const jsonStr = gameStateStore.exportToJsonString();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = selectedScenarioName || "football_scenario.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.overlayContainer}>
      {/* Top Header Bar */}
      <div style={styles.header}>
        <div style={styles.logoGroup}>
          <span style={styles.logoIcon}>⚽</span>
          <div>
            <h1 style={styles.title}>Football Intelligence Visualizer</h1>
            <p style={styles.subtitle}>GameState Editor & Scenario Builder</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div style={styles.tabContainer}>
          <button
            onClick={() => setActiveTab("editor")}
            style={{
              ...styles.tabButton,
              ...(activeTab === "editor" ? styles.activeTab : {}),
            }}
          >
            Visualizer & Editor
          </button>
          <button
            onClick={() => setActiveTab("builder")}
            style={{
              ...styles.tabButton,
              ...(activeTab === "builder" ? styles.activeTab : {}),
            }}
          >
            Scenario Builder
          </button>
        </div>

        {/* Edit Mode Toggle Switch */}
        <div style={styles.editToggleContainer}>
          <span style={{ ...styles.toggleLabel, color: editMode ? "#00ff88" : "#aaaaaa" }}>
            {editMode ? "EDITING ON" : "VIEW ONLY"}
          </span>
          <button
            onClick={() => gameStateStore.setEditMode(!editMode)}
            style={{
              ...styles.toggleSwitch,
              backgroundColor: editMode ? "#00ff88" : "#444444",
            }}
          >
            <div
              style={{
                ...styles.toggleKnob,
                transform: editMode ? "translateX(20px)" : "translateX(0px)",
              }}
            />
          </button>
        </div>
      </div>

      {/* Main UI Panels */}
      <div style={styles.mainLayout}>
        {/* Left Control Panel */}
        <div style={styles.sidebar}>
          {activeTab === "editor" ? (
            <>
              {/* Scenario Manager Section */}
              <div style={styles.section}>
                <h3 style={styles.sectionHeader}>Scenario Actions</h3>

                {/* Dropdown list */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Select Scenario</label>
                  <select
                    value={selectedScenarioName || ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        gameStateStore.loadScenario(e.target.value);
                      } else {
                        gameStateStore.newScenario();
                      }
                    }}
                    style={styles.select}
                  >
                    <option value="">-- Start New Scenario --</option>
                    {scenariosList.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* CRUD Controls */}
                <div style={styles.buttonGrid}>
                  <button
                    onClick={() => gameStateStore.newScenario()}
                    style={styles.primaryButton}
                  >
                    New Scenario
                  </button>

                  <button
                    onClick={() => {
                      if (selectedScenarioName) {
                        gameStateStore.saveCurrentScenario();
                      } else {
                        setShowSaveAs(true);
                      }
                    }}
                    disabled={!isDirty && selectedScenarioName !== null}
                    style={{
                      ...styles.secondaryButton,
                      opacity: (!isDirty && selectedScenarioName !== null) ? 0.5 : 1,
                    }}
                  >
                    Save {isDirty ? "*" : ""}
                  </button>

                  <button
                    onClick={() => {
                      setSaveAsName(selectedScenarioName ? selectedScenarioName.replace(".json", "") : "");
                      setShowSaveAs(true);
                    }}
                    style={styles.secondaryButton}
                  >
                    Save As...
                  </button>

                  <button
                    disabled={!selectedScenarioName}
                    onClick={() => {
                      if (selectedScenarioName) {
                        const name = prompt("Enter name for duplicated scenario:", `Copy_of_${selectedScenarioName.replace(".json", "")}`);
                        if (name) gameStateStore.duplicateScenario(name);
                      }
                    }}
                    style={{
                      ...styles.secondaryButton,
                      opacity: !selectedScenarioName ? 0.5 : 1,
                    }}
                  >
                    Duplicate
                  </button>

                  <button
                    disabled={!selectedScenarioName}
                    onClick={() => {
                      if (selectedScenarioName && confirm(`Delete ${selectedScenarioName}?`)) {
                        gameStateStore.deleteScenario(selectedScenarioName);
                      }
                    }}
                    style={{
                      ...styles.dangerButton,
                      gridColumn: "span 2",
                      opacity: !selectedScenarioName ? 0.5 : 1,
                    }}
                  >
                    Delete Scenario
                  </button>
                </div>

                <div style={styles.divider} />

                {/* Export / Import */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>JSON Filesystem Backup</label>
                  <div style={styles.buttonGrid}>
                    <button onClick={handleJsonExport} style={styles.exportButton}>
                      Export JSON
                    </button>
                    <label style={styles.importLabel}>
                      Import JSON
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleJsonImport}
                        style={{ display: "none" }}
                      />
                    </label>
                  </div>
                </div>
              </div>


            </>
          ) : (
            /* Scenario Builder Tab */
            <div style={styles.section}>
              <h3 style={styles.sectionHeader}>Scenario Builder</h3>
              <p style={styles.builderHelp}>
                This mode lets you instantly place teams in kickoff shapes and edit player orientations.
              </p>

              <div style={styles.builderActions}>
                <button
                  onClick={() => {
                    gameStateStore.newScenario();
                    alert("Placed Team A in 4-2-3-1 and Team B in 4-3-3 kickoff formation.");
                  }}
                  style={styles.builderPrimaryButton}
                >
                  ⚡ Load Kickoff Formations Stance
                </button>

                <button
                  onClick={() => {
                    gameStateStore.addReferee();
                  }}
                  style={styles.builderSecondaryButton}
                >
                  ➕ Add Referee to Pitch
                </button>

                <button
                  onClick={() => {
                    // Mirror Team A players to Team B or center them
                    alert("Rearrange entities by dragging them anywhere on the field. Ensure Edit Mode is toggled ON.");
                  }}
                  style={styles.builderSecondaryButton}
                >
                  ℹ️ Editing Workflow Guide
                </button>
              </div>

              <div style={styles.divider} />
              <div style={styles.workflowHint}>
                <strong>Tip for Fast Creation:</strong>
                <ol style={{ paddingLeft: 16, margin: "6px 0" }}>
                  <li>Toggle Edit Mode ON.</li>
                  <li>Click "Load Kickoff Formations".</li>
                  <li>Drag players and rotate using handles.</li>
                  <li>Assign ball possession in properties.</li>
                  <li>Save Scenario.</li>
                </ol>
                Ready in under 30 seconds!
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar Inspector (Properties) */}
        <div style={{ ...styles.sidebar, marginLeft: "auto" }}>
          <div style={styles.section}>
            <h3 style={styles.sectionHeader}>Entity Inspector</h3>

            {selectedPlayer ? (
              <div>
                <div style={styles.inspectorHeader}>
                  <span
                    style={{
                      ...styles.roleBadge,
                      backgroundColor:
                        selectedPlayer.team === "A"
                          ? "#1f72ff"
                          : selectedPlayer.team === "B"
                          ? "#cccccc"
                          : "#444444",
                      color: selectedPlayer.team === "A" ? "#ffffff" : "#000000",
                    }}
                  >
                    {selectedPlayer.referee
                      ? "REFEREE"
                      : selectedPlayer.goalkeeper
                      ? "GOALKEEPER"
                      : "OUTFIELD"}
                  </span>
                  <span style={styles.inspectorPlayerId}>{selectedPlayer.id}</span>
                </div>

                {/* Team Selection */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Team Assignment</label>
                  <select
                    value={selectedPlayer.team}
                    onChange={(e) =>
                      gameStateStore.updatePlayerFlags(selectedPlayer.id, {
                        team: e.target.value as "A" | "B" | "NONE",
                      })
                    }
                    style={styles.select}
                  >
                    <option value="A">Team A (Blue)</option>
                    <option value="B">Team B (White)</option>
                    <option value="NONE">Neutral (Referee)</option>
                  </select>
                </div>

                {/* Jersey Number */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Jersey Number / Display Label</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={selectedPlayer.jerseyNumber || ""}
                    onChange={(e) =>
                      gameStateStore.updatePlayerJerseyNumber(selectedPlayer.id, e.target.value)
                    }
                    placeholder="e.g. 10, GK, R"
                    style={styles.input}
                  />
                </div>

                {/* Location X, Y */}
                <div style={styles.coordinatesGroup}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Pitch X (0-100)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.5"
                      value={selectedPlayer.x}
                      onChange={(e) =>
                        gameStateStore.updatePlayerPosition(
                          selectedPlayer.id,
                          Number(e.target.value),
                          selectedPlayer.y
                        )
                      }
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Pitch Y (0-60)</label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      step="0.5"
                      value={selectedPlayer.y}
                      onChange={(e) =>
                        gameStateStore.updatePlayerPosition(
                          selectedPlayer.id,
                          selectedPlayer.x,
                          Number(e.target.value)
                        )
                      }
                      style={styles.input}
                    />
                  </div>
                </div>

                {/* Rotation (Heading Angle) */}
                <div style={styles.formGroup}>
                  <div style={styles.labelRow}>
                    <label style={styles.label}>Heading Angle (Orientation)</label>
                    <span style={styles.valueDisplay}>{selectedPlayer.heading_angle}°</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="359"
                    value={selectedPlayer.heading_angle}
                    onChange={(e) =>
                      gameStateStore.updatePlayerHeading(selectedPlayer.id, Number(e.target.value))
                    }
                    style={styles.range}
                  />
                  <div style={styles.angleTicks}>
                    <span>0° (R)</span>
                    <span>90° (U)</span>
                    <span>180° (L)</span>
                    <span>270° (D)</span>
                  </div>
                </div>

                {/* Goalkeeper / Referee Roles */}
                <div style={styles.checkboxGroup}>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={selectedPlayer.goalkeeper}
                      disabled={selectedPlayer.referee}
                      onChange={(e) =>
                        gameStateStore.updatePlayerFlags(selectedPlayer.id, {
                          goalkeeper: e.target.checked,
                        })
                      }
                      style={styles.checkbox}
                    />
                    Goalkeeper Jersey Stance
                  </label>
                  <label style={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={selectedPlayer.referee}
                      onChange={(e) =>
                        gameStateStore.updatePlayerFlags(selectedPlayer.id, {
                          referee: e.target.checked,
                        })
                      }
                      style={styles.checkbox}
                    />
                    Referee Role Flag
                  </label>
                </div>

                <div style={styles.divider} />

                {/* Ball Possession */}
                <button
                  onClick={() => gameStateStore.updateBallPossession(selectedPlayer.id)}
                  style={{
                    ...styles.actionButton,
                    backgroundColor:
                      state.ball.playerIdWhoHasPossession === selectedPlayer.id
                        ? "#ffd700"
                        : "#3a7d44",
                    color:
                      state.ball.playerIdWhoHasPossession === selectedPlayer.id
                        ? "#000"
                        : "#fff",
                  }}
                >
                  ⚽ {state.ball.playerIdWhoHasPossession === selectedPlayer.id ? "Has Possession!" : "Give Possession"}
                </button>

                <button
                  onClick={() => gameStateStore.deletePlayer(selectedPlayer.id)}
                  style={styles.dangerBlockButton}
                >
                  ❌ Remove Player from Scenario
                </button>
              </div>
            ) : (
              <div>
                <p style={styles.noSelection}>Select a player on the pitch to inspect or edit their attributes.</p>
                <div style={styles.divider} />
                
                {/* Ball Properties */}
                <h4 style={styles.ballHeader}>Ball State</h4>
                <div style={styles.coordinatesGroup}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Ball X</label>
                    <input
                      type="number"
                      value={state.ball.x}
                      onChange={(e) => gameStateStore.updateBallPosition(Number(e.target.value), state.ball.y)}
                      style={styles.input}
                    />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Ball Y</label>
                    <input
                      type="number"
                      value={state.ball.y}
                      onChange={(e) => gameStateStore.updateBallPosition(state.ball.x, Number(e.target.value))}
                      style={styles.input}
                    />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Possession</label>
                  <select
                    value={state.ball.playerIdWhoHasPossession || ""}
                    onChange={(e) => gameStateStore.updateBallPossession(e.target.value || null)}
                    style={styles.select}
                  >
                    <option value="">-- Neutral (Loose Ball) --</option>
                    {state.players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} ({p.team === "A" ? "Team A" : p.team === "B" ? "Team B" : "Referee"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save As Dialog */}
      {showSaveAs && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modalContent}>
            <h3 style={styles.modalTitle}>Save Scenario As</h3>
            <input
              type="text"
              placeholder="e.g. counter_attack_press"
              value={saveAsName}
              onChange={(e) => setSaveAsName(e.target.value)}
              style={styles.modalInput}
            />
            <div style={styles.modalButtons}>
              <button
                onClick={() => setShowSaveAs(false)}
                style={styles.modalCancel}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (saveAsName.trim()) {
                    gameStateStore.saveScenario(saveAsName.trim());
                    setShowSaveAs(false);
                  }
                }}
                style={styles.modalSave}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div style={styles.loadingOverlay}>
          <div style={styles.spinner} />
          <span style={styles.loadingText}>Processing Scenario...</span>
        </div>
      )}
    </div>
  );
}

// Inline Premium Styling
const styles: Record<string, React.CSSProperties> = {
  overlayContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    pointerEvents: "none", // Let clicks pass through to Phaser canvas where needed
    display: "flex",
    flexDirection: "column",
    fontFamily: "'Inter', sans-serif, system-ui",
    color: "#fff",
    boxSizing: "border-box",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "rgba(10, 18, 14, 0.45)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: "16px",
    zIndex: 300,
    pointerEvents: "auto", // blocks all interaction
  },
  spinner: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    border: "4px solid rgba(0, 255, 136, 0.15)",
    borderTop: "4px solid #00ff88",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "1.5px",
    color: "#00ff88",
    textTransform: "uppercase",
  },
  header: {
    pointerEvents: "auto",
    background: "rgba(10, 18, 14, 0.75)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
    padding: "10px 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 102,
  },
  logoGroup: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  logoIcon: {
    fontSize: "24px",
  },
  title: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    background: "linear-gradient(90deg, #ffffff, #00ff88)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  subtitle: {
    margin: 0,
    fontSize: "11px",
    color: "#888888",
  },
  tabContainer: {
    display: "flex",
    gap: "6px",
    background: "rgba(0, 0, 0, 0.4)",
    padding: "4px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  tabButton: {
    background: "none",
    border: "none",
    color: "#888888",
    padding: "6px 14px",
    fontSize: "12px",
    fontWeight: 600,
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  activeTab: {
    background: "rgba(255, 255, 255, 0.1)",
    color: "#ffffff",
    boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
  },
  editToggleContainer: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  toggleLabel: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "1px",
  },
  toggleSwitch: {
    width: "44px",
    height: "24px",
    borderRadius: "12px",
    border: "none",
    padding: "2px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    transition: "background-color 0.25s ease",
  },
  toggleKnob: {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    backgroundColor: "#ffffff",
    boxShadow: "0 2px 4px rgba(0,0,0,0.4)",
    transition: "transform 0.25s cubic-bezier(0.19, 1, 0.22, 1)",
  },
  mainLayout: {
    flex: 1,
    display: "flex",
    justifyContent: "space-between",
    padding: "12px",
    pointerEvents: "none", // Let middle of viewport clicks pass to canvas
  },
  sidebar: {
    pointerEvents: "auto",
    width: "250px",
    background: "rgba(10, 18, 14, 0.85)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "16px",
    padding: "16px",
    boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    overflowY: "auto",
    maxHeight: "calc(100vh - 120px)",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  sectionHeader: {
    margin: 0,
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    borderLeft: "3px solid #00ff88",
    paddingLeft: "8px",
    color: "#e2e8f0",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  labelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#a0aec0",
  },
  valueDisplay: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#00ff88",
  },
  select: {
    background: "rgba(0, 0, 0, 0.5)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    color: "#fff",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    outline: "none",
    cursor: "pointer",
  },
  input: {
    background: "rgba(0, 0, 0, 0.5)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    color: "#fff",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "12px",
    outline: "none",
  },
  range: {
    width: "100%",
    cursor: "pointer",
    accentColor: "#00ff88",
  },
  angleTicks: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "9px",
    color: "#718096",
  },
  coordinatesGroup: {
    display: "flex",
    gap: "10px",
  },
  buttonGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  primaryButton: {
    background: "linear-gradient(135deg, #00ff88, #00b359)",
    color: "#000",
    fontWeight: 700,
    fontSize: "11px",
    border: "none",
    borderRadius: "8px",
    padding: "9px 12px",
    cursor: "pointer",
    textTransform: "uppercase",
    transition: "all 0.15s ease",
  },
  secondaryButton: {
    background: "rgba(255, 255, 255, 0.08)",
    color: "#fff",
    fontWeight: 600,
    fontSize: "11px",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: "8px",
    padding: "9px 12px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  dangerButton: {
    background: "rgba(255, 50, 50, 0.15)",
    color: "#ff6666",
    fontWeight: 600,
    fontSize: "11px",
    border: "1px solid rgba(255, 50, 50, 0.3)",
    borderRadius: "8px",
    padding: "9px 12px",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  exportButton: {
    background: "rgba(0, 255, 136, 0.1)",
    color: "#00ff88",
    border: "1px solid rgba(0, 255, 136, 0.3)",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
  },
  importLabel: {
    background: "rgba(255, 255, 255, 0.05)",
    color: "#ccc",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    textAlign: "center",
  },
  divider: {
    height: "1px",
    background: "rgba(255, 255, 255, 0.1)",
    margin: "4px 0",
  },
  overlayToggles: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "12px",
    color: "#cbd5e0",
    cursor: "pointer",
  },
  checkbox: {
    cursor: "pointer",
    accentColor: "#00ff88",
  },
  builderHelp: {
    margin: 0,
    fontSize: "12px",
    color: "#a0aec0",
    lineHeight: "1.5",
  },
  builderActions: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  builderPrimaryButton: {
    background: "linear-gradient(135deg, #1f72ff, #0b2f88)",
    color: "#fff",
    fontWeight: 700,
    fontSize: "12px",
    border: "none",
    borderRadius: "8px",
    padding: "11px 16px",
    cursor: "pointer",
    transition: "transform 0.1s ease",
  },
  builderSecondaryButton: {
    background: "rgba(255, 255, 255, 0.05)",
    color: "#fff",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    padding: "10px 16px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
  },
  workflowHint: {
    fontSize: "11px",
    color: "#888",
    background: "rgba(0, 0, 0, 0.2)",
    padding: "10px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.04)",
  },
  noSelection: {
    fontSize: "11.5px",
    color: "#718096",
    textAlign: "center",
    padding: "12px 0",
    fontStyle: "italic",
  },
  inspectorHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  },
  roleBadge: {
    fontSize: "10px",
    fontWeight: 700,
    padding: "4px 8px",
    borderRadius: "4px",
    letterSpacing: "0.5px",
  },
  inspectorPlayerId: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#ffffff",
  },
  checkboxGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    margin: "12px 0",
  },
  actionButton: {
    border: "none",
    borderRadius: "8px",
    padding: "10px",
    fontSize: "12px",
    fontWeight: 700,
    cursor: "pointer",
    width: "100%",
    textTransform: "uppercase",
    marginBottom: "8px",
    display: "flex",
    justifyContent: "center",
    gap: "6px",
  },
  dangerBlockButton: {
    background: "rgba(255, 50, 50, 0.1)",
    color: "#ff6666",
    border: "1px solid rgba(255, 50, 50, 0.2)",
    borderRadius: "8px",
    padding: "9px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
  },
  ballHeader: {
    margin: "0 0 10px 0",
    fontSize: "12px",
    fontWeight: 700,
    textTransform: "uppercase",
    color: "#fff",
  },
  modalBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200,
    pointerEvents: "auto",
  },
  modalContent: {
    background: "rgba(18, 28, 22, 0.95)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: "16px",
    padding: "24px",
    width: "320px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
  },
  modalTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 700,
  },
  modalInput: {
    background: "rgba(0,0,0,0.4)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "8px",
    padding: "10px",
    color: "#fff",
    fontSize: "13px",
    outline: "none",
  },
  modalButtons: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },
  modalCancel: {
    background: "none",
    border: "none",
    color: "#aaa",
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
  },
  modalSave: {
    background: "linear-gradient(135deg, #00ff88, #00b359)",
    color: "#000",
    border: "none",
    borderRadius: "8px",
    padding: "8px 20px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 700,
  },
};
