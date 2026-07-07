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

  const currentSequence = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getCurrentSequence.bind(gameStateStore)
  );

  const selectedBoardIndex = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getSelectedBoardIndex.bind(gameStateStore)
  );

  const isLoading = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getIsLoading.bind(gameStateStore)
  );

  const showZoneOfInfluence = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getShowZoneOfInfluence.bind(gameStateStore)
  );

  const showVulnerability = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getShowVulnerability.bind(gameStateStore)
  );

  const showPassingOptions = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getShowPassingOptions.bind(gameStateStore)
  );

  const showOpponentPassingOptions = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getShowOpponentPassingOptions.bind(gameStateStore)
  );

  const showAvailableRuns = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getShowAvailableRuns.bind(gameStateStore)
  );

  const showOpponentRuns = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getShowOpponentRuns.bind(gameStateStore)
  );

  const showAttackingOverload = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getShowAttackingOverload.bind(gameStateStore)
  );

  const showDefensiveOverload = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getShowDefensiveOverload.bind(gameStateStore)
  );

  // Tab State
  const [activeTab, setActiveTab] = useState<"editor" | "builder">("editor");

  // Save As modal/state
  const [saveAsName, setSaveAsName] = useState("");
  const [showSaveAs, setShowSaveAs] = useState(false);

  // AI Tactical Analysis Modal States
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisPayload, setAnalysisPayload] = useState<any | null>(null);
  const [analysisCache, setAnalysisCache] = useState<Record<string, string>>({});

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

  const handleTacticalAnalysis = async (mode: "current" | "sequence") => {
    setShowAnalysisModal(true);
    
    try {
      const payload = gameStateStore.getTacticalAnalysisPayload(mode);
      setAnalysisPayload(payload);
      const payloadStr = JSON.stringify(payload);

      if (analysisCache[payloadStr]) {
        // Cache hit: instantly display result
        setAnalysisResult(analysisCache[payloadStr]);
        setAnalysisLoading(false);
        setAnalysisError(null);
        return;
      }

      // Cache miss: proceed to fetch
      setAnalysisLoading(true);
      setAnalysisResult(null);
      setAnalysisError(null);

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadStr
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAnalysisResult(data.analysis);

      // Save to cache
      setAnalysisCache(prev => ({
        ...prev,
        [payloadStr]: data.analysis
      }));
    } catch (e: any) {
      console.error("AI Analysis failed:", e);
      setAnalysisError(e.message || "An unexpected error occurred while generating the report.");
    } finally {
      setAnalysisLoading(false);
    }
  };

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

              <div style={styles.divider} />

              {/* Scenario Sequence */}
              <div style={styles.section}>
                <h3 style={styles.sectionHeader}>Scenario Sequence</h3>
                <button
                  onClick={() => {
                    const name = prompt("Enter sequence name:", "New Sequence");
                    if (name) gameStateStore.newSequence(name);
                  }}
                  style={styles.primaryButton}
                >
                  ➕ New Sequence
                </button>

                {currentSequence && (
                  <>
                    <div style={styles.sequenceNameContainer}>
                      <span style={styles.sequenceNameLabel}>Current Sequence</span>
                      <span
                        onClick={() => {
                          const newName = prompt("Rename sequence to:", currentSequence.name);
                          if (newName) gameStateStore.renameSequence(newName);
                        }}
                        style={styles.sequenceNameValue}
                        title="Click to rename sequence"
                      >
                        {currentSequence.name} ✏️
                      </span>
                    </div>

                    <div style={styles.sequenceList}>
                      {currentSequence.boards.map((board, idx) => {
                        const isActive = selectedBoardIndex === idx;
                        const displayName = board.name || `State ${idx + 1}`;
                        return (
                          <div
                            key={idx}
                            style={{
                              ...styles.sequenceItem,
                              ...(isActive ? styles.sequenceItemActive : {}),
                            }}
                          >
                            <span
                              onClick={() => gameStateStore.selectSequenceBoard(idx)}
                              style={styles.sequenceItemName}
                              title="Click to load this board state"
                            >
                              {displayName}
                            </span>
                            <div style={styles.sequenceItemActions}>
                              <button
                                onClick={() => {
                                  const newName = prompt("Rename state to:", displayName);
                                  if (newName) gameStateStore.renameSequenceBoard(idx, newName);
                                }}
                                style={styles.smallIconButton}
                                title="Rename State"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => gameStateStore.moveSequenceBoard(idx, "up")}
                                disabled={idx === 0}
                                style={{
                                  ...styles.smallIconButton,
                                  opacity: idx === 0 ? 0.3 : 1,
                                }}
                                title="Move Up"
                              >
                                ▲
                              </button>
                              <button
                                onClick={() => gameStateStore.moveSequenceBoard(idx, "down")}
                                disabled={idx === currentSequence.boards.length - 1}
                                style={{
                                  ...styles.smallIconButton,
                                  opacity: idx === currentSequence.boards.length - 1 ? 0.3 : 1,
                                }}
                                title="Move Down"
                              >
                                ▼
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div style={{ ...styles.buttonGrid, marginTop: "12px" }}>
                      <button
                        onClick={() => gameStateStore.addCurrentBoardToSequence()}
                        style={styles.secondaryButton}
                      >
                        ➕ Add Current Board
                      </button>
                      <button
                        onClick={() => {
                          if (selectedBoardIndex !== null) {
                            gameStateStore.duplicateSequenceBoard(selectedBoardIndex);
                          }
                        }}
                        disabled={selectedBoardIndex === null}
                        style={{
                          ...styles.secondaryButton,
                          opacity: selectedBoardIndex === null ? 0.5 : 1,
                        }}
                      >
                        Duplicate Selected
                      </button>
                      <button
                        onClick={() => {
                          if (selectedBoardIndex !== null && confirm("Delete selected state from sequence?")) {
                            gameStateStore.deleteSequenceBoard(selectedBoardIndex);
                          }
                        }}
                        disabled={selectedBoardIndex === null}
                        style={{
                          ...styles.dangerButton,
                          gridColumn: "span 2",
                          opacity: selectedBoardIndex === null ? 0.5 : 1,
                        }}
                      >
                        Delete Selected
                      </button>
                    </div>

                    <div style={styles.sequenceNavRow}>
                      <button
                        onClick={() => {
                          if (selectedBoardIndex !== null && selectedBoardIndex > 0) {
                            gameStateStore.selectSequenceBoard(selectedBoardIndex - 1);
                          }
                        }}
                        disabled={selectedBoardIndex === null || selectedBoardIndex === 0}
                        style={{
                          ...styles.navArrowButton,
                          opacity: (selectedBoardIndex === null || selectedBoardIndex === 0) ? 0.4 : 1,
                        }}
                      >
                        ◀ Prev
                      </button>
                      <span style={styles.navProgressText}>
                        {selectedBoardIndex !== null
                          ? `${selectedBoardIndex + 1} / ${currentSequence.boards.length}`
                          : "0 / 0"}
                      </span>
                      <button
                        onClick={() => {
                          if (
                            selectedBoardIndex !== null &&
                            selectedBoardIndex < currentSequence.boards.length - 1
                          ) {
                            gameStateStore.selectSequenceBoard(selectedBoardIndex + 1);
                          }
                        }}
                        disabled={
                          selectedBoardIndex === null ||
                          selectedBoardIndex === currentSequence.boards.length - 1
                        }
                        style={{
                          ...styles.navArrowButton,
                          opacity:
                            selectedBoardIndex === null ||
                            selectedBoardIndex === currentSequence.boards.length - 1
                              ? 0.4
                              : 1,
                        }}
                      >
                        Next ▶
                      </button>
                    </div>
                  </>
                )}
              </div>

              {!editMode && (
                <>
                  <div style={styles.divider} />
                  <div style={styles.section}>
                    <h3 style={styles.sectionHeader}>Analysis</h3>
                    <button
                      onClick={() => gameStateStore.toggleZoneOfInfluence()}
                      style={{
                        ...styles.secondaryButton,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-start",
                        gap: "8px",
                        background: showZoneOfInfluence
                          ? "rgba(0, 255, 136, 0.15)"
                          : "rgba(255, 255, 255, 0.05)",
                        border: showZoneOfInfluence
                          ? "1px solid rgba(0, 255, 136, 0.4)"
                          : "1px solid rgba(255, 255, 255, 0.1)",
                        color: showZoneOfInfluence ? "#00ff88" : "#ccc",
                        padding: "10px 14px",
                        width: "100%",
                        fontSize: "12px",
                        fontWeight: 600,
                        textAlign: "left",
                        cursor: "pointer",
                        borderRadius: "8px",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                        {showZoneOfInfluence ? "✓" : "○"}
                      </span>
                      <span>Zone of Influence</span>
                    </button>

                    {(() => {
                      const possessor = state.players.find(p => p.id === state.ball.playerIdWhoHasPossession);
                      const isTeamAAttacking = possessor?.team === "A";
                      const isTeamBAttacking = possessor?.team === "B";
                      return (
                        <>
                          <button
                            onClick={() => {
                              if (isTeamBAttacking) {
                                gameStateStore.toggleVulnerability();
                              }
                            }}
                            disabled={!isTeamBAttacking}
                            style={{
                              ...styles.secondaryButton,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-start",
                              gap: "8px",
                              background: showVulnerability && isTeamBAttacking
                                ? "rgba(231, 76, 60, 0.15)"
                                : "rgba(255, 255, 255, 0.05)",
                              border: showVulnerability && isTeamBAttacking
                                ? "1px solid rgba(231, 76, 60, 0.4)"
                                : "1px solid rgba(255, 255, 255, 0.1)",
                              color: !isTeamBAttacking
                                ? "#666"
                                : showVulnerability
                                ? "#ff4d4d"
                                : "#ccc",
                              padding: "10px 14px",
                              width: "100%",
                              fontSize: "12px",
                              fontWeight: 600,
                              textAlign: "left",
                              cursor: isTeamBAttacking ? "pointer" : "not-allowed",
                              borderRadius: "8px",
                              transition: "all 0.2s ease",
                              marginTop: "8px",
                              opacity: isTeamBAttacking ? 1 : 0.4,
                            }}
                            title={!isTeamBAttacking ? "Only active when Team B (Opponent) has possession" : "Toggle Vulnerability Analysis"}
                          >
                            <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                              {showVulnerability && isTeamBAttacking ? "✓" : "○"}
                            </span>
                            <span>Vulnerability Analysis {!isTeamBAttacking && "🔒"}</span>
                          </button>

                          <button
                            onClick={() => {
                              if (isTeamAAttacking) {
                                gameStateStore.togglePassingOptions();
                              }
                            }}
                            disabled={!isTeamAAttacking}
                            style={{
                              ...styles.secondaryButton,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-start",
                              gap: "8px",
                              background: showPassingOptions && isTeamAAttacking
                                ? "rgba(0, 255, 136, 0.15)"
                                : "rgba(255, 255, 255, 0.05)",
                              border: showPassingOptions && isTeamAAttacking
                                ? "1px solid rgba(0, 255, 136, 0.4)"
                                : "1px solid rgba(255, 255, 255, 0.1)",
                              color: !isTeamAAttacking
                                ? "#666"
                                : showPassingOptions
                                ? "#00ff88"
                                : "#ccc",
                              padding: "10px 14px",
                              width: "100%",
                              fontSize: "12px",
                              fontWeight: 600,
                              textAlign: "left",
                              cursor: isTeamAAttacking ? "pointer" : "not-allowed",
                              borderRadius: "8px",
                              transition: "all 0.2s ease",
                              marginTop: "8px",
                              opacity: isTeamAAttacking ? 1 : 0.4,
                            }}
                            title={!isTeamAAttacking ? "Only active when Team A has possession" : "Toggle Teammate Passing Options"}
                          >
                            <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                              {showPassingOptions && isTeamAAttacking ? "✓" : "○"}
                            </span>
                            <span>Passing Options {!isTeamAAttacking && "🔒"}</span>
                          </button>

                          <button
                            onClick={() => {
                              if (isTeamBAttacking) {
                                gameStateStore.toggleOpponentPassingOptions();
                              }
                            }}
                            disabled={!isTeamBAttacking}
                            style={{
                              ...styles.secondaryButton,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-start",
                              gap: "8px",
                              background: showOpponentPassingOptions && isTeamBAttacking
                                ? "rgba(231, 76, 60, 0.15)"
                                : "rgba(255, 255, 255, 0.05)",
                              border: showOpponentPassingOptions && isTeamBAttacking
                                ? "1px solid rgba(231, 76, 60, 0.4)"
                                : "1px solid rgba(255, 255, 255, 0.1)",
                              color: !isTeamBAttacking
                                ? "#666"
                                : showOpponentPassingOptions
                                ? "#ff4d4d"
                                : "#ccc",
                              padding: "10px 14px",
                              width: "100%",
                              fontSize: "12px",
                              fontWeight: 600,
                              textAlign: "left",
                              cursor: isTeamBAttacking ? "pointer" : "not-allowed",
                              borderRadius: "8px",
                              transition: "all 0.2s ease",
                              marginTop: "8px",
                              opacity: isTeamBAttacking ? 1 : 0.4,
                            }}
                            title={!isTeamBAttacking ? "Only active when Team B (Opponent) has possession" : "Toggle Opponent Passing Options"}
                          >
                            <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                              {showOpponentPassingOptions && isTeamBAttacking ? "✓" : "○"}
                            </span>
                            <span>Opponent Passing Options {!isTeamBAttacking && "🔒"}</span>
                          </button>

                          <button
                            onClick={() => {
                              if (isTeamAAttacking) {
                                gameStateStore.toggleAvailableRuns();
                              }
                            }}
                            disabled={!isTeamAAttacking}
                            style={{
                              ...styles.secondaryButton,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-start",
                              gap: "8px",
                              background: showAvailableRuns && isTeamAAttacking
                                ? "rgba(0, 255, 136, 0.15)"
                                : "rgba(255, 255, 255, 0.05)",
                              border: showAvailableRuns && isTeamAAttacking
                                ? "1px solid rgba(0, 255, 136, 0.4)"
                                : "1px solid rgba(255, 255, 255, 0.1)",
                              color: !isTeamAAttacking
                                ? "#666"
                                : showAvailableRuns
                                ? "#00ff88"
                                : "#ccc",
                              padding: "10px 14px",
                              width: "100%",
                              fontSize: "12px",
                              fontWeight: 600,
                              textAlign: "left",
                              cursor: isTeamAAttacking ? "pointer" : "not-allowed",
                              borderRadius: "8px",
                              transition: "all 0.2s ease",
                              marginTop: "8px",
                              opacity: isTeamAAttacking ? 1 : 0.4,
                            }}
                            title={!isTeamAAttacking ? "Only active when Team A has possession" : "Toggle Available Runs"}
                          >
                            <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                              {showAvailableRuns && isTeamAAttacking ? "✓" : "○"}
                            </span>
                            <span>Available Runs {!isTeamAAttacking && "🔒"}</span>
                          </button>

                          <button
                            onClick={() => {
                              if (isTeamBAttacking) {
                                gameStateStore.toggleOpponentRuns();
                              }
                            }}
                            disabled={!isTeamBAttacking}
                            style={{
                              ...styles.secondaryButton,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-start",
                              gap: "8px",
                              background: showOpponentRuns && isTeamBAttacking
                                ? "rgba(231, 76, 60, 0.15)"
                                : "rgba(255, 255, 255, 0.05)",
                              border: showOpponentRuns && isTeamBAttacking
                                ? "1px solid rgba(231, 76, 60, 0.4)"
                                : "1px solid rgba(255, 255, 255, 0.1)",
                              color: !isTeamBAttacking
                                ? "#666"
                                : showOpponentRuns
                                ? "#ff4d4d"
                                : "#ccc",
                              padding: "10px 14px",
                              width: "100%",
                              fontSize: "12px",
                              fontWeight: 600,
                              textAlign: "left",
                              cursor: isTeamBAttacking ? "pointer" : "not-allowed",
                              borderRadius: "8px",
                              transition: "all 0.2s ease",
                              marginTop: "8px",
                              opacity: isTeamBAttacking ? 1 : 0.4,
                            }}
                            title={!isTeamBAttacking ? "Only active when Team B (Opponent) has possession" : "Toggle Opponent Runs"}
                          >
                            <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                              {showOpponentRuns && isTeamBAttacking ? "✓" : "○"}
                            </span>
                            <span>Opponent Runs {!isTeamBAttacking && "🔒"}</span>
                          </button>

                          <button
                            onClick={() => {
                              if (isTeamAAttacking) {
                                gameStateStore.toggleAttackingOverload();
                              }
                            }}
                            disabled={!isTeamAAttacking}
                            style={{
                              ...styles.secondaryButton,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-start",
                              gap: "8px",
                              background: showAttackingOverload && isTeamAAttacking
                                ? "rgba(155, 89, 182, 0.15)"
                                : "rgba(255, 255, 255, 0.05)",
                              border: showAttackingOverload && isTeamAAttacking
                                ? "1px solid rgba(155, 89, 182, 0.4)"
                                : "1px solid rgba(255, 255, 255, 0.1)",
                              color: !isTeamAAttacking
                                ? "#666"
                                : showAttackingOverload
                                ? "#b784e8"
                                : "#ccc",
                              padding: "10px 14px",
                              width: "100%",
                              fontSize: "12px",
                              fontWeight: 600,
                              textAlign: "left",
                              cursor: isTeamAAttacking ? "pointer" : "not-allowed",
                              borderRadius: "8px",
                              transition: "all 0.2s ease",
                              marginTop: "8px",
                              opacity: isTeamAAttacking ? 1 : 0.4,
                            }}
                            title={!isTeamAAttacking ? "Only active when Team A has possession" : "Toggle Attacking Overload"}
                          >
                            <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                              {showAttackingOverload && isTeamAAttacking ? "✓" : "○"}
                            </span>
                            <span>Attacking Overloads {!isTeamAAttacking && "🔒"}</span>
                          </button>

                          <button
                            onClick={() => {
                              if (isTeamBAttacking) {
                                gameStateStore.toggleDefensiveOverload();
                              }
                            }}
                            disabled={!isTeamBAttacking}
                            style={{
                              ...styles.secondaryButton,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-start",
                              gap: "8px",
                              background: showDefensiveOverload && isTeamBAttacking
                                ? "rgba(155, 89, 182, 0.15)"
                                : "rgba(255, 255, 255, 0.05)",
                              border: showDefensiveOverload && isTeamBAttacking
                                ? "1px solid rgba(155, 89, 182, 0.4)"
                                : "1px solid rgba(255, 255, 255, 0.1)",
                              color: !isTeamBAttacking
                                ? "#666"
                                : showDefensiveOverload
                                ? "#b784e8"
                                : "#ccc",
                              padding: "10px 14px",
                              width: "100%",
                              fontSize: "12px",
                              fontWeight: 600,
                              textAlign: "left",
                              cursor: isTeamBAttacking ? "pointer" : "not-allowed",
                              borderRadius: "8px",
                              transition: "all 0.2s ease",
                              marginTop: "8px",
                              opacity: isTeamBAttacking ? 1 : 0.4,
                            }}
                            title={!isTeamBAttacking ? "Only active when Team B has possession" : "Toggle Defensive Overload"}
                          >
                            <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                              {showDefensiveOverload && isTeamBAttacking ? "✓" : "○"}
                            </span>
                            <span>Defensive Overloads {!isTeamBAttacking && "🔒"}</span>
                          </button>

                          <div style={{ marginTop: "20px", borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: "16px" }}>
                            <h4 style={{ margin: "0 0 10px", fontSize: "11px", textTransform: "uppercase", color: "#b784e8", fontWeight: 700, letterSpacing: "1px" }}>AI Tactical Assistant</h4>
                            
                            <button
                              onClick={() => handleTacticalAnalysis("current")}
                              disabled={editMode}
                              style={{
                                ...styles.secondaryButton,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "8px",
                                background: "linear-gradient(135deg, #8e44ad, #9b59b6)",
                                border: "none",
                                color: "#fff",
                                padding: "12px 14px",
                                width: "100%",
                                fontSize: "12px",
                                fontWeight: 700,
                                cursor: editMode ? "pointer" : "pointer",
                                borderRadius: "8px",
                                transition: "all 0.2s ease",
                                boxShadow: "0 4px 15px rgba(142, 68, 173, 0.3)"
                              }}
                              title="Generate AI analysis for the current frame"
                            >
                              <span>✨</span>
                              <span>Analyze Current Frame</span>
                            </button>

                            {currentSequence && currentSequence.boards.length > 0 && (
                              <button
                                onClick={() => handleTacticalAnalysis("sequence")}
                                disabled={editMode}
                                style={{
                                  ...styles.secondaryButton,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: "8px",
                                  background: "rgba(142, 68, 173, 0.15)",
                                  border: "1px solid rgba(142, 68, 173, 0.4)",
                                  color: "#d896ff",
                                  padding: "12px 14px",
                                  width: "100%",
                                  fontSize: "12px",
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  borderRadius: "8px",
                                  transition: "all 0.2s ease",
                                  marginTop: "8px"
                                }}
                                title="Generate AI analysis for the entire sequence"
                              >
                                <span>🎬</span>
                                <span>Analyze Full Sequence ({currentSequence.boards.length} Boards)</span>
                              </button>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </>
              )}

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
      {/* AI Tactical Analysis Modal */}
      {showAnalysisModal && (
        <div style={{
          ...styles.modalBackdrop,
          background: "rgba(0, 0, 0, 0.75)"
        }}>
          <div style={{
            ...styles.modalContent,
            width: "1020px",
            maxWidth: "95vw",
            maxHeight: "85vh",
            overflowY: "auto",
            background: "rgba(18, 28, 22, 0.98)",
            padding: "28px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "14px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "20px" }}>✨</span>
                <h3 style={{ ...styles.modalTitle, fontSize: "18px", color: "#fff" }}>Team A AI Performance Report</h3>
              </div>
              <button
                onClick={() => setShowAnalysisModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#aaa",
                  cursor: "pointer",
                  fontSize: "18px",
                  fontWeight: "bold",
                  padding: "4px 8px"
                }}
              >
                ✕
              </button>
            </div>

            {analysisLoading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: "16px" }}>
                <div style={{
                  width: "40px",
                  height: "40px",
                  border: "4px solid rgba(142, 68, 173, 0.2)",
                  borderTop: "4px solid #9b59b6",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite"
                }} />
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#fff", fontWeight: 600, fontSize: "14px", margin: "0 0 6px" }}>AI Analyst is Processing Data...</p>
                  <p style={{ color: "#8e44ad", fontSize: "11px", fontStyle: "italic", margin: 0 }}>Evaluating overloads, spaces, progressive passes, and channels...</p>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                {analysisError && (
                  <div style={{ background: "rgba(231, 76, 60, 0.12)", border: "1px solid rgba(231, 76, 60, 0.4)", borderRadius: "8px", padding: "12px 16px", color: "#ff7675", fontSize: "13px" }}>
                    ⚠️ <strong>Analysis API Key Missing or Error:</strong> {analysisError}
                    <div style={{ fontSize: "11px", marginTop: "4px", color: "#ff9f43" }}>Note: The raw numerical telemetry dashboard is fully available on the right.</div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "24px", alignItems: "stretch" }}>
                  
                  {/* Left Column: AI report */}
                  <div style={{
                    background: "rgba(255,255,255,0.015)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    borderRadius: "12px",
                    padding: "20px",
                    maxHeight: "58vh",
                    overflowY: "auto"
                  }}>
                    <h3 style={{ color: "#b784e8", fontSize: "14px", margin: "0 0 16px 0", fontWeight: 700, borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>📝</span> Architectural Audit Report
                    </h3>
                    
                    {analysisResult ? (
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {(() => {
                          const sections = parseReportToSections(analysisResult);
                          if (sections.length === 0) {
                            return renderMarkdown(analysisResult);
                          }
                          return sections.map((sec, idx) => renderSectionCard(sec, idx));
                        })()}
                      </div>
                    ) : (
                      <div style={{ padding: "40px 0", textAlign: "center", color: "#888" }}>
                        <span style={{ fontSize: "28px" }}>📊</span>
                        <p style={{ margin: "10px 0 0 0", fontSize: "12px" }}>No report generated. Refer to telemetry values in the right sidebar.</p>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Quantitative Telemetry Dashboard */}
                  <div style={{
                    maxHeight: "58vh",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "16px",
                    paddingRight: "4px"
                  }}>
                    {(() => {
                      const avg = calculateAverageMetrics(analysisPayload);
                      if (!avg) return <p style={{ color: "#aaa" }}>No telemetry data found.</p>;

                      return (
                        <>
                          {/* Section 1: In Possession */}
                          <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", padding: "16px" }}>
                            <h4 style={{ color: "#2ecc71", margin: "0 0 12px 0", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", justifyContent: "space-between" }}>
                              <span>🟢 In Possession (Attacking)</span>
                              <span style={{ color: "#aaa", fontSize: "10px" }}>{avg.attacking.count} frames</span>
                            </h4>
                            
                            {avg.attacking.count > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
                                <div>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", marginBottom: "4px" }}>
                                    <span>Zone of Influence (Overall):</span>
                                    <span style={{ color: "#fff", fontWeight: 600 }}>A: {avg.attacking.influence.teamA}% / B: {avg.attacking.influence.teamB}%</span>
                                  </div>
                                  <div style={{ height: "4px", background: "#333", borderRadius: "2px", display: "flex", overflow: "hidden" }}>
                                    <div style={{ width: `${avg.attacking.influence.teamA}%`, background: "#2ecc71" }} />
                                    <div style={{ width: `${avg.attacking.influence.contested}%`, background: "#95a5a6" }} />
                                    <div style={{ width: `${avg.attacking.influence.teamB}%`, background: "#e74c3c" }} />
                                  </div>
                                </div>

                                <div>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", marginBottom: "4px" }}>
                                    <span>Zone of Influence (Middle Third):</span>
                                    <span style={{ color: "#fff", fontWeight: 600 }}>A: {avg.attacking.influenceThirds?.middle.teamA}% / B: {avg.attacking.influenceThirds?.middle.teamB}%</span>
                                  </div>
                                  <div style={{ height: "4px", background: "#333", borderRadius: "2px", display: "flex", overflow: "hidden" }}>
                                    <div style={{ width: `${avg.attacking.influenceThirds?.middle.teamA}%`, background: "#2ecc71" }} />
                                    <div style={{ width: `${avg.attacking.influenceThirds?.middle.contested}%`, background: "#95a5a6" }} />
                                    <div style={{ width: `${avg.attacking.influenceThirds?.middle.teamB}%`, background: "#e74c3c" }} />
                                  </div>
                                </div>

                                <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "6px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", marginBottom: "4px" }}>
                                    <span>Avg Progressive Passing Options:</span>
                                    <span style={{ color: "#fff", fontWeight: 600 }}>{avg.attacking.progressiveOptions}</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa" }}>
                                    <span>Avg progressive safe cells:</span>
                                    <span style={{ color: "#fff", fontWeight: 600 }}>{avg.attacking.safeArea} grids</span>
                                  </div>
                                </div>

                                <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "6px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", marginBottom: "4px" }}>
                                    <span>Avg Available Run Channels:</span>
                                    <span style={{ color: "#fff", fontWeight: 600 }}>{avg.attacking.runs}</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#85c1e9", fontSize: "11px", paddingLeft: "8px" }}>
                                    <span>Left: {avg.attacking.runsLeft} / Center: {avg.attacking.runsCenter} / Right: {avg.attacking.runsRight}</span>
                                  </div>
                                </div>

                                <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "6px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", marginBottom: "4px" }}>
                                    <span>Avg Attacking Overloads (2v2):</span>
                                    <span style={{ color: "#fff", fontWeight: 600 }}>{avg.attacking.overloads} ({avg.attacking.overloadArea} grids)</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#d7bde2", fontSize: "11px", paddingLeft: "8px" }}>
                                    <span>Left: {avg.attacking.overloadsLeft} / Center: {avg.attacking.overloadsCenter} / Right: {avg.attacking.overloadsRight}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p style={{ color: "#666", fontSize: "11px", margin: 0, fontStyle: "italic" }}>No attacking frames detected in this sequence.</p>
                            )}
                          </div>

                          {/* Section 2: Out of Possession */}
                          <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "12px", padding: "16px" }}>
                            <h4 style={{ color: "#e74c3c", margin: "0 0 12px 0", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", justifyContent: "space-between" }}>
                              <span>🔴 Out of Possession (Defending)</span>
                              <span style={{ color: "#aaa", fontSize: "10px" }}>{avg.defending.count} frames</span>
                            </h4>

                            {avg.defending.count > 0 ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
                                <div>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", marginBottom: "4px" }}>
                                    <span>Zone of Influence (Overall):</span>
                                    <span style={{ color: "#fff", fontWeight: 600 }}>A: {avg.defending.influence.teamA}% / B: {avg.defending.influence.teamB}%</span>
                                  </div>
                                  <div style={{ height: "4px", background: "#333", borderRadius: "2px", display: "flex", overflow: "hidden" }}>
                                    <div style={{ width: `${avg.defending.influence.teamA}%`, background: "#2ecc71" }} />
                                    <div style={{ width: `${avg.defending.influence.contested}%`, background: "#95a5a6" }} />
                                    <div style={{ width: `${avg.defending.influence.teamB}%`, background: "#e74c3c" }} />
                                  </div>
                                </div>

                                <div>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", marginBottom: "4px" }}>
                                    <span>Zone of Influence (Defensive Third):</span>
                                    <span style={{ color: "#fff", fontWeight: 600 }}>A: {avg.defending.influenceThirds?.defensive.teamA}% / B: {avg.defending.influenceThirds?.defensive.teamB}%</span>
                                  </div>
                                  <div style={{ height: "4px", background: "#333", borderRadius: "2px", display: "flex", overflow: "hidden" }}>
                                    <div style={{ width: `${avg.defending.influenceThirds?.defensive.teamA}%`, background: "#2ecc71" }} />
                                    <div style={{ width: `${avg.defending.influenceThirds?.defensive.contested}%`, background: "#95a5a6" }} />
                                    <div style={{ width: `${avg.defending.influenceThirds?.defensive.teamB}%`, background: "#e74c3c" }} />
                                  </div>
                                </div>

                                <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "6px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa" }}>
                                    <span>Avg Vulnerable Regions:</span>
                                    <span style={{ color: "#e74c3c", fontWeight: 600 }}>{avg.defending.vulnerability.regions} ({avg.defending.vulnerability.area} grids)</span>
                                  </div>
                                </div>

                                <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "6px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", marginBottom: "4px" }}>
                                    <span>Avg Opponent Progressive Options:</span>
                                    <span style={{ color: "#fff", fontWeight: 600 }}>{avg.defending.progressiveOptions}</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa" }}>
                                    <span>Avg Opponent progressive safe cells:</span>
                                    <span style={{ color: "#fff", fontWeight: 600 }}>{avg.defending.safeArea} grids</span>
                                  </div>
                                </div>

                                <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "6px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", marginBottom: "4px" }}>
                                    <span>Avg Opponent Run Channels:</span>
                                    <span style={{ color: "#fff", fontWeight: 600 }}>{avg.defending.runs}</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#85c1e9", fontSize: "11px", paddingLeft: "8px" }}>
                                    <span>Left: {avg.defending.runsLeft} / Center: {avg.defending.runsCenter} / Right: {avg.defending.runsRight}</span>
                                  </div>
                                </div>

                                <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "6px" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", marginBottom: "4px" }}>
                                    <span>Avg Defensive Overloads (2v2):</span>
                                    <span style={{ color: "#fff", fontWeight: 600 }}>{avg.defending.overloads} ({avg.defending.overloadArea} grids)</span>
                                  </div>
                                  <div style={{ display: "flex", justifyContent: "space-between", color: "#d7bde2", fontSize: "11px", paddingLeft: "8px" }}>
                                    <span>Left: {avg.defending.overloadsLeft} / Center: {avg.defending.overloadsCenter} / Right: {avg.defending.overloadsRight}</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p style={{ color: "#666", fontSize: "11px", margin: 0, fontStyle: "italic" }}>No defensive frames detected in this sequence.</p>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>

                </div>

                <div style={{ ...styles.modalButtons, borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: "14px", marginTop: "8px" }}>
                  <button
                    onClick={() => setShowAnalysisModal(false)}
                    style={{ ...styles.modalSave, background: "rgba(255, 255, 255, 0.08)", color: "#fff" }}
                  >
                    Close Report
                  </button>
                </div>
              </div>
            )}
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
  sequenceNameContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    margin: "10px 0",
    background: "rgba(255, 255, 255, 0.03)",
    padding: "8px",
    borderRadius: "6px",
    border: "1px solid rgba(255, 255, 255, 0.05)",
  },
  sequenceNameLabel: {
    fontSize: "10px",
    textTransform: "uppercase",
    color: "#a0aec0",
    letterSpacing: "0.5px",
  },
  sequenceNameValue: {
    fontSize: "13px",
    fontWeight: 700,
    color: "#00ff88",
    cursor: "pointer",
    textDecoration: "underline dashed rgba(0, 255, 136, 0.5)",
  },
  sequenceList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    maxHeight: "200px",
    overflowY: "auto",
    paddingRight: "4px",
    margin: "10px 0",
  },
  sequenceItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 10px",
    background: "rgba(255, 255, 255, 0.02)",
    border: "1px solid rgba(255, 255, 255, 0.05)",
    borderRadius: "8px",
    gap: "8px",
  },
  sequenceItemActive: {
    background: "rgba(0, 255, 136, 0.08)",
    border: "1px solid rgba(0, 255, 136, 0.3)",
  },
  sequenceItemName: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#e2e8f0",
    cursor: "pointer",
    flex: 1,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  sequenceItemActions: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  smallIconButton: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "10px",
    padding: "2px",
    color: "#ccc",
  },
  sequenceNavRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    marginTop: "12px",
    background: "rgba(0, 0, 0, 0.2)",
    padding: "6px",
    borderRadius: "8px",
  },
  navArrowButton: {
    background: "rgba(255, 255, 255, 0.08)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "6px",
    color: "#fff",
    fontSize: "11px",
    fontWeight: 700,
    padding: "6px 12px",
    cursor: "pointer",
  },
  navProgressText: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#a0aec0",
  },
};

const calculateAverageMetrics = (payload: any) => {
  if (!payload || !payload.frames || payload.frames.length === 0) return null;

  const attackingFrames = payload.frames.filter((f: any) => f.possessionTeam === "A");
  const defendingFrames = payload.frames.filter((f: any) => f.possessionTeam === "B");

  const averageList = (frames: any[], keySelector: (f: any) => number) => {
    if (frames.length === 0) return 0;
    const sum = frames.reduce((acc, f) => acc + keySelector(f), 0);
    return Math.round((sum / frames.length) * 10) / 10;
  };

  const averageObject = (frames: any[], path: "zoneOfInfluence" | "defensiveThird" | "middleThird" | "attackingThird") => {
    if (frames.length === 0) return { teamA: 0, teamB: 0, contested: 0 };
    let a = 0, b = 0, c = 0;
    frames.forEach(f => {
      const obj = path === "zoneOfInfluence" ? f.zoneOfInfluence.overall : f.zoneOfInfluence[path];
      if (obj) {
        a += obj.teamA || 0;
        b += obj.teamB || 0;
        c += obj.contested || 0;
      }
    });
    return {
      teamA: Math.round((a / frames.length) * 10) / 10,
      teamB: Math.round((b / frames.length) * 10) / 10,
      contested: Math.round((c / frames.length) * 10) / 10
    };
  };

  return {
    attacking: {
      count: attackingFrames.length,
      influence: averageObject(attackingFrames, "zoneOfInfluence"),
      influenceThirds: attackingFrames.length > 0 ? {
        defensive: averageObject(attackingFrames, "defensiveThird"),
        middle: averageObject(attackingFrames, "middleThird"),
        attacking: averageObject(attackingFrames, "attackingThird")
      } : null,
      progressiveOptions: averageList(attackingFrames, f => f.passingOptions.progressiveOptionsCount),
      safeArea: averageList(attackingFrames, f => f.passingOptions.averageSafeCellsOfProgressiveOptions),
      runs: averageList(attackingFrames, f => f.runningChannels.totalRunsCount),
      runsLeft: averageList(attackingFrames, f => f.runningChannels.runsInLeft),
      runsRight: averageList(attackingFrames, f => f.runningChannels.runsInRight),
      runsCenter: averageList(attackingFrames, f => f.runningChannels.runsInCenter),
      overloads: averageList(attackingFrames, f => f.attackingOverloads.totalOverloadsCount),
      overloadArea: averageList(attackingFrames, f => f.attackingOverloads.totalOverloadCells),
      overloadsLeft: averageList(attackingFrames, f => f.attackingOverloads.overloadsInLeft),
      overloadsRight: averageList(attackingFrames, f => f.attackingOverloads.overloadsInRight),
      overloadsCenter: averageList(attackingFrames, f => f.attackingOverloads.overloadsInCenter)
    },
    defending: {
      count: defendingFrames.length,
      influence: averageObject(defendingFrames, "zoneOfInfluence"),
      influenceThirds: defendingFrames.length > 0 ? {
        defensive: averageObject(defendingFrames, "defensiveThird"),
        middle: averageObject(defendingFrames, "middleThird"),
        attacking: averageObject(defendingFrames, "attackingThird")
      } : null,
      vulnerability: {
        regions: averageList(defendingFrames, f => f.vulnerabilityDefendingHalf.vulnerableRegionsCount),
        area: averageList(defendingFrames, f => f.vulnerabilityDefendingHalf.totalVulnerableCells)
      },
      progressiveOptions: averageList(defendingFrames, f => f.opponentPassingOptions.progressiveOptionsCount),
      safeArea: averageList(defendingFrames, f => f.opponentPassingOptions.averageSafeCellsOfProgressiveOptions),
      runs: averageList(defendingFrames, f => f.opponentRuns.totalRunsCount),
      runsLeft: averageList(defendingFrames, f => f.opponentRuns.runsInLeft),
      runsRight: averageList(defendingFrames, f => f.opponentRuns.runsInRight),
      runsCenter: averageList(defendingFrames, f => f.opponentRuns.runsInCenter),
      overloads: averageList(defendingFrames, f => f.defensiveOverloads.totalOverloadsCount),
      overloadArea: averageList(defendingFrames, f => f.defensiveOverloads.totalOverloadCells),
      overloadsLeft: averageList(defendingFrames, f => f.defensiveOverloads.overloadsInLeft),
      overloadsRight: averageList(defendingFrames, f => f.defensiveOverloads.overloadsInRight),
      overloadsCenter: averageList(defendingFrames, f => f.defensiveOverloads.overloadsInCenter)
    }
  };
};

const renderMarkdown = (text: string) => {
  const lines = text.split("\n");
  return lines.map((line, idx) => {
    if (line.startsWith("### ")) {
      return <h4 key={idx} style={{ margin: "16px 0 8px", color: "#b784e8", fontSize: "14px", fontWeight: 700 }}>{line.slice(4)}</h4>;
    }
    if (line.startsWith("## ")) {
      return <h3 key={idx} style={{ margin: "20px 0 10px", color: "#9b59b6", fontSize: "15px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "4px", fontWeight: 700 }}>{line.slice(3)}</h3>;
    }
    if (line.startsWith("# ")) {
      return <h2 key={idx} style={{ margin: "24px 0 12px", color: "#fff", fontSize: "17px", fontWeight: 700 }}>{line.slice(2)}</h2>;
    }
    if (line.startsWith("- ") || line.startsWith("* ")) {
      return (
        <li key={idx} style={{ marginLeft: "16px", marginBottom: "4px", color: "#ccc", listStyleType: "disc" }}>
          {parseInlineMarkdown(line.slice(2))}
        </li>
      );
    }
    const numMatch = line.match(/^(\d+)\.\s(.*)/);
    if (numMatch) {
      return (
        <div key={idx} style={{ display: "flex", gap: "8px", marginLeft: "8px", marginBottom: "6px", color: "#ccc" }}>
          <span style={{ color: "#9b59b6", fontWeight: "bold" }}>{numMatch[1]}.</span>
          <span>{parseInlineMarkdown(numMatch[2])}</span>
        </div>
      );
    }
    if (line.trim() === "") {
      return <div key={idx} style={{ height: "8px" }} />;
    }
    return <p key={idx} style={{ margin: "0 0 8px", color: "#ddd", lineHeight: "1.5", fontSize: "13px" }}>{parseInlineMarkdown(line)}</p>;
  });
};

const parseInlineMarkdown = (text: string) => {
  const parts: any[] = [];
  let remaining = text;
  
  while (remaining.length > 0) {
    const boldIndex = remaining.indexOf("**");
    if (boldIndex === -1) {
      parts.push(remaining);
      break;
    }
    
    if (boldIndex > 0) {
      parts.push(remaining.slice(0, boldIndex));
    }
    
    const nextBoldIndex = remaining.indexOf("**", boldIndex + 2);
    if (nextBoldIndex === -1) {
      parts.push(remaining.slice(boldIndex));
      break;
    }
    
    const boldText = remaining.slice(boldIndex + 2, nextBoldIndex);
    parts.push(<strong key={boldIndex} style={{ color: "#fff", fontWeight: 600 }}>{boldText}</strong>);
    remaining = remaining.slice(nextBoldIndex + 2);
  }
  
  return parts;
};

interface ReportSection {
  title: string;
  items: string[];
}

const parseReportToSections = (text: string): ReportSection[] => {
  const sections: ReportSection[] = [];
  let currentSection: ReportSection | null = null;
  const lines = text.split("\n");

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (trimmed === "") return;

    // Detect section headers (markdown header tags, bold headers, or numbered bold headers)
    const isHeader = trimmed.startsWith("###") || 
                     trimmed.startsWith("##") || 
                     trimmed.startsWith("#") || 
                     (trimmed.startsWith("**") && trimmed.endsWith("**")) ||
                     /^\d+\.\s+\*\*/.test(trimmed);
    
    if (isHeader) {
      const cleanTitle = trimmed
        .replace(/^(?:###|##|#|\d+\.)\s*/, "")
        .replace(/\*\*/g, "")
        .trim();
      currentSection = { title: cleanTitle, items: [] };
      sections.push(currentSection);
    } else if (currentSection) {
      let cleanItem = trimmed;
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        cleanItem = trimmed.slice(2);
      } else if (trimmed.startsWith("• ")) {
        cleanItem = trimmed.slice(2);
      }
      currentSection.items.push(cleanItem);
    }
  });

  return sections;
};

const renderSectionCard = (section: ReportSection, idx: number) => {
  const titleLower = section.title.toLowerCase();
  
  let icon = "📊";
  let color = "#3498db";
  
  if (titleLower.includes("overview") || titleLower.includes("compactness") || titleLower.includes("stability")) {
    icon = "📐";
    color = "#b784e8";
  } else if (titleLower.includes("attacking") || titleLower.includes("exploit") || titleLower.includes("opening")) {
    icon = "🎯";
    color = "#2ecc71";
  } else if (titleLower.includes("defensive") || titleLower.includes("gap") || titleLower.includes("vulnerability") || titleLower.includes("flaw")) {
    icon = "⚠️";
    color = "#e74c3c";
  } else if (titleLower.includes("key") || titleLower.includes("node") || titleLower.includes("pivot") || titleLower.includes("terminal")) {
    icon = "🔑";
    color = "#ff9f43";
  }

  return (
    <div key={idx} style={{
      background: "rgba(255, 255, 255, 0.015)",
      border: "1px solid rgba(255, 255, 255, 0.05)",
      borderLeft: `4px solid ${color}`,
      borderRadius: "12px",
      padding: "16px 20px",
      marginBottom: "16px",
      boxShadow: "0 4px 15px rgba(0, 0, 0, 0.15)",
      transition: "all 0.2s ease"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
        <span style={{ fontSize: "16px" }}>{icon}</span>
        <h4 style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {section.title}
        </h4>
      </div>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {section.items.map((item, itemIdx) => (
          <div key={itemIdx} style={{
            display: "flex",
            gap: "10px",
            alignItems: "flex-start",
            fontSize: "12.5px",
            color: "#ccc",
            lineHeight: "1.5"
          }}>
            <span style={{ color: color, fontSize: "11px", marginTop: "3px" }}>⚡</span>
            <div style={{ flex: 1 }}>{parseInlineMarkdown(item)}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
