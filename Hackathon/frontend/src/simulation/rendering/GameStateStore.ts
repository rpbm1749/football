/**
 * GameStateStore.ts
 *
 * Manages the client-side state of the GameState Editor and Visualizer.
 * Communicates with the Vite API backend to Save, Load, Duplicate, and Delete scenarios.
 * Emits change events so React components and Phaser scenes can reactively update.
 */

export interface PlayerStateJSON {
  id: string;
  team: "A" | "B" | "NONE";
  goalkeeper: boolean;
  referee: boolean;
  x: number;
  y: number;
  heading_angle: number; // 0 to 360 degrees counter-clockwise (standard mathematical coordinates)
  jerseyNumber?: string;
}

export interface BallStateJSON {
  x: number;
  y: number;
  playerIdWhoHasPossession: string | null;
}

export interface GameStateJSON {
  players: PlayerStateJSON[];
  ball: BallStateJSON;
}

export type GameStateActionType = "load" | "update" | "list_update" | "selection_update";

export interface GameStateAction {
  type: GameStateActionType;
}

export type GameStateSubscriber = (action: GameStateAction) => void;

// Default layout coordinates: Y goes from 0 (bottom) to 60 (top)
// Left-to-right kickoff positions (Team A faces right, Team B faces left)
export function createDefaultGameState(): GameStateJSON {
  const players: PlayerStateJSON[] = [];

  // --- Team A: 4-2-3-1 Formation (Home - faces Right: 0 degrees) ---
  // Goalkeeper
  players.push({
    id: "A_GK",
    team: "A",
    goalkeeper: true,
    referee: false,
    x: 5.0,
    y: 30.0,
    heading_angle: 0,
    jerseyNumber: "1",
  });

  // Defenders: LB, CB, CB, RB
  const defendersA = [
    { id: "A_LB", x: 20.0, y: 10.0, num: "3" },
    { id: "A_LCB", x: 15.0, y: 22.5, num: "4" },
    { id: "A_RCB", x: 15.0, y: 37.5, num: "5" },
    { id: "A_RB", x: 20.0, y: 50.0, num: "2" },
  ];
  defendersA.forEach((d) => {
    players.push({
      id: d.id,
      team: "A",
      goalkeeper: false,
      referee: false,
      x: d.x,
      y: d.y,
      heading_angle: 0,
      jerseyNumber: d.num,
    });
  });

  // Defensive Midfielders: LDMC, RDMC
  const dmsA = [
    { id: "A_LDMC", x: 32.0, y: 20.0, num: "6" },
    { id: "A_RDMC", x: 32.0, y: 40.0, num: "8" },
  ];
  dmsA.forEach((dm) => {
    players.push({
      id: dm.id,
      team: "A",
      goalkeeper: false,
      referee: false,
      x: dm.x,
      y: dm.y,
      heading_angle: 0,
      jerseyNumber: dm.num,
    });
  });

  // Attacking Midfielders: LAM, CAM, RAM
  const amsA = [
    { id: "A_LAM", x: 42.0, y: 12.0, num: "11" },
    { id: "A_CAM", x: 42.0, y: 30.0, num: "10" },
    { id: "A_RAM", x: 42.0, y: 48.0, num: "7" },
  ];
  amsA.forEach((am) => {
    players.push({
      id: am.id,
      team: "A",
      goalkeeper: false,
      referee: false,
      x: am.x,
      y: am.y,
      heading_angle: 0,
      jerseyNumber: am.num,
    });
  });

  // Striker: ST (positioned slightly to the left of the center circle)
  players.push({
    id: "A_ST",
    team: "A",
    goalkeeper: false,
    referee: false,
    x: 48.5,
    y: 30.0,
    heading_angle: 0,
    jerseyNumber: "9",
  });

  // --- Team B: 4-3-3 Formation (Away - faces Left: 180 degrees) ---
  // Goalkeeper
  players.push({
    id: "B_GK",
    team: "B",
    goalkeeper: true,
    referee: false,
    x: 95.0,
    y: 30.0,
    heading_angle: 180,
    jerseyNumber: "1",
  });

  // Defenders: LB, CB, CB, RB
  const defendersB = [
    { id: "B_LB", x: 80.0, y: 50.0, num: "3" },
    { id: "B_LCB", x: 85.0, y: 37.5, num: "4" },
    { id: "B_RCB", x: 85.0, y: 22.5, num: "5" },
    { id: "B_RB", x: 80.0, y: 10.0, num: "2" },
  ];
  defendersB.forEach((d) => {
    players.push({
      id: d.id,
      team: "B",
      goalkeeper: false,
      referee: false,
      x: d.x,
      y: d.y,
      heading_angle: 180,
      jerseyNumber: d.num,
    });
  });

  // Midfielders: CDM, LCM, RCM
  const midsB = [
    { id: "B_CDM", x: 70.0, y: 30.0, num: "6" },
    { id: "B_LCM", x: 60.0, y: 40.0, num: "8" },
    { id: "B_RCM", x: 60.0, y: 20.0, num: "10" },
  ];
  midsB.forEach((m) => {
    players.push({
      id: m.id,
      team: "B",
      goalkeeper: false,
      referee: false,
      x: m.x,
      y: m.y,
      heading_angle: 180,
      jerseyNumber: m.num,
    });
  });

  // Attackers: LW, RW, ST
  const strikersB = [
    { id: "B_LW", x: 55.0, y: 50.0, num: "11" },
    { id: "B_RW", x: 55.0, y: 10.0, num: "7" },
    { id: "B_ST", x: 51.5, y: 30.0, num: "9" },
  ];
  strikersB.forEach((s) => {
    players.push({
      id: s.id,
      team: "B",
      goalkeeper: false,
      referee: false,
      x: s.x,
      y: s.y,
      heading_angle: 180,
      jerseyNumber: s.num,
    });
  });

  return {
    players,
    ball: {
      x: 50.0,
      y: 30.0,
      playerIdWhoHasPossession: null,
    },
  };
}

export class GameStateStore {
  private gameState: GameStateJSON;
  private editMode: boolean = false;
  private selectedScenarioName: string | null = null;
  private scenariosList: string[] = [];
  private selectedPlayerId: string | null = null;
  private isDirty: boolean = false;
  private isLoading: boolean = false;
  private activeOverlays: Record<string, boolean> = {
    passLanes: false,
    influenceZone: false,
  };

  private readonly subscribers = new Set<GameStateSubscriber>();

  constructor() {
    this.gameState = createDefaultGameState();
  }

  // --- Subscription ---
  subscribe(subscriber: GameStateSubscriber): () => void {
    this.subscribers.add(subscriber);
    return () => this.subscribers.delete(subscriber);
  }

  private notify(type: GameStateActionType = "update"): void {
    // Clone state to trigger react useSyncExternalStore change detection instantly
    this.gameState = {
      ...this.gameState,
      players: this.gameState.players.map((p) => ({ ...p })),
      ball: { ...this.gameState.ball },
    };
    for (const subscriber of this.subscribers) {
      subscriber({ type });
    }
  }

  // --- Getters ---
  getSnapshot(): GameStateJSON {
    return this.gameState;
  }

  getEditMode(): boolean {
    return this.editMode;
  }

  getSelectedScenarioName(): string | null {
    return this.selectedScenarioName;
  }

  getScenariosList(): string[] {
    return this.scenariosList;
  }

  getSelectedPlayerId(): string | null {
    return this.selectedPlayerId;
  }

  getIsLoading(): boolean {
    return this.isLoading;
  }

  getIsDirty(): boolean {
    return this.isDirty;
  }

  getOverlays(): Record<string, boolean> {
    return this.activeOverlays;
  }

  // --- State Mutators ---
  setLoading(loading: boolean): void {
    if (this.isLoading === loading) return;
    this.isLoading = loading;
    this.notify("update");
  }

  setEditMode(enabled: boolean): void {
    if (this.editMode === enabled) return;
    this.editMode = enabled;
    this.notify("update");
  }

  setSelectedPlayerId(playerId: string | null): void {
    if (this.selectedPlayerId === playerId) return;
    this.selectedPlayerId = playerId;
    this.notify("selection_update");
  }

  toggleOverlay(overlayName: string): void {
    this.activeOverlays[overlayName] = !this.activeOverlays[overlayName];
    this.notify("update");
  }

  updatePlayerPosition(id: string, x: number, y: number): void {
    const player = this.gameState.players.find((p) => p.id === id);
    if (!player) return;
    if (player.x === x && player.y === y) return;
    player.x = Number(x.toFixed(2));
    player.y = Number(y.toFixed(2));
    this.isDirty = true;
    this.notify("update");
  }

  updatePlayerHeading(id: string, heading: number): void {
    const player = this.gameState.players.find((p) => p.id === id);
    if (!player) return;
    // Normalize heading to [0, 360)
    let normHeading = heading % 360;
    if (normHeading < 0) normHeading += 360;
    normHeading = Number(normHeading.toFixed(1));

    if (player.heading_angle === normHeading) return;
    player.heading_angle = normHeading;
    this.isDirty = true;
    this.notify("update");
  }

  updatePlayerJerseyNumber(id: string, num: string): void {
    const player = this.gameState.players.find((p) => p.id === id);
    if (!player) return;
    if (player.jerseyNumber === num) return;
    player.jerseyNumber = num;
    this.isDirty = true;
    this.notify("update");
  }

  updatePlayerFlags(id: string, updates: { goalkeeper?: boolean; referee?: boolean; team?: "A" | "B" | "NONE" }): void {
    const player = this.gameState.players.find((p) => p.id === id);
    if (!player) return;
    let changed = false;
    if (updates.goalkeeper !== undefined && player.goalkeeper !== updates.goalkeeper) {
      player.goalkeeper = updates.goalkeeper;
      changed = true;
    }
    if (updates.referee !== undefined && player.referee !== updates.referee) {
      player.referee = updates.referee;
      if (updates.referee) {
        player.team = "NONE";
        player.goalkeeper = false;
      }
      changed = true;
    }
    if (updates.team !== undefined && player.team !== updates.team) {
      player.team = updates.team;
      changed = true;
    }
    if (changed) {
      this.isDirty = true;
      this.notify("load"); // Force full Phaser redraw
    }
  }

  addReferee(): void {
    const id = `REF_${this.gameState.players.filter(p => p.referee).length + 1}`;
    this.gameState.players.push({
      id,
      team: "NONE",
      goalkeeper: false,
      referee: true,
      x: 50.0,
      y: 15.0,
      heading_angle: 90, // facing up
    });
    this.isDirty = true;
    this.notify("load"); // Force full Phaser redraw
  }

  deletePlayer(id: string): void {
    const index = this.gameState.players.findIndex(p => p.id === id);
    if (index !== -1) {
      this.gameState.players.splice(index, 1);
      if (this.selectedPlayerId === id) {
        this.selectedPlayerId = null;
      }
      if (this.gameState.ball.playerIdWhoHasPossession === id) {
        this.gameState.ball.playerIdWhoHasPossession = null;
      }
      this.isDirty = true;
      this.notify("load"); // Force full Phaser redraw
    }
  }

  updateBallPosition(x: number, y: number): void {
    const ball = this.gameState.ball;
    if (ball.x === x && ball.y === y) return;
    ball.x = Number(x.toFixed(2));
    ball.y = Number(y.toFixed(2));
    this.isDirty = true;
    this.notify("update");
  }

  updateBallPossession(playerId: string | null): void {
    const ball = this.gameState.ball;
    if (ball.playerIdWhoHasPossession === playerId) return;
    ball.playerIdWhoHasPossession = playerId;

    // Place the ball in front of the player if possession is claimed
    if (playerId) {
      const player = this.gameState.players.find(p => p.id === playerId);
      if (player) {
        const rad = (player.heading_angle * Math.PI) / 180;
        // Place ball 1.8 units in front of player circle
        ball.x = Number((player.x + Math.cos(rad) * 1.8).toFixed(2));
        ball.y = Number((player.y + Math.sin(rad) * 1.8).toFixed(2));
      }
    }

    this.isDirty = true;
    this.notify("update");
  }

  // --- API Endpoints ---
  async fetchScenariosList(): Promise<void> {
    this.setLoading(true);
    try {
      const response = await fetch("/api/scenarios");
      if (response.ok) {
        this.scenariosList = await response.json();
        this.notify("list_update");
      }
    } catch (e) {
      console.error("Failed to load scenarios list from backend:", e);
    } finally {
      this.setLoading(false);
    }
  }

  async loadScenario(name: string): Promise<void> {
    this.setLoading(true);
    try {
      const response = await fetch(`/api/scenarios/${name}`);
      if (response.ok) {
        const data = await response.json();
        this.gameState = data;
        this.selectedScenarioName = name;
        this.isDirty = false;
        this.selectedPlayerId = null;
        this.notify("load");
      }
    } catch (e) {
      console.error(`Failed to load scenario ${name}:`, e);
    } finally {
      this.setLoading(false);
    }
  }

  newScenario(): void {
    this.gameState = createDefaultGameState();
    this.selectedScenarioName = null;
    this.isDirty = false;
    this.selectedPlayerId = null;
    this.notify("load");
  }

  async saveCurrentScenario(): Promise<void> {
    if (!this.selectedScenarioName) {
      console.error("Cannot save: No scenario name selected. Use Save As...");
      return;
    }
    await this.saveScenario(this.selectedScenarioName);
  }

  async saveScenario(name: string): Promise<void> {
    const filename = name.endsWith(".json") ? name : `${name}.json`;
    this.setLoading(true);
    try {
      const response = await fetch(`/api/scenarios/${filename}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.gameState, null, 2),
      });
      if (response.ok) {
        this.selectedScenarioName = filename;
        this.isDirty = false;
        await this.fetchScenariosList();
        this.notify("update");
      } else {
        const err = await response.json();
        alert(`Failed to save: ${err.error || response.statusText}`);
      }
    } catch (e) {
      console.error(`Failed to save scenario ${filename}:`, e);
    } finally {
      this.setLoading(false);
    }
  }

  async duplicateScenario(name: string): Promise<void> {
    if (!this.selectedScenarioName) return;
    const filename = name.endsWith(".json") ? name : `${name}.json`;
    this.setLoading(true);
    try {
      const response = await fetch(`/api/scenarios/${this.selectedScenarioName}/duplicate?newName=${filename}`, {
        method: "POST",
      });
      if (response.ok) {
        await this.fetchScenariosList();
        await this.loadScenario(filename);
      }
    } catch (e) {
      console.error(`Failed to duplicate scenario:`, e);
    } finally {
      this.setLoading(false);
    }
  }

  async deleteScenario(name: string): Promise<void> {
    const filename = name.endsWith(".json") ? name : `${name}.json`;
    this.setLoading(true);
    try {
      const response = await fetch(`/api/scenarios/${filename}`, {
        method: "DELETE",
      });
      if (response.ok) {
        await this.fetchScenariosList();
        if (this.selectedScenarioName === filename) {
          this.newScenario();
        }
      }
    } catch (e) {
      console.error(`Failed to delete scenario ${filename}:`, e);
    } finally {
      this.setLoading(false);
    }
  }

  // --- Import / Export ---
  exportToJsonString(): string {
    return JSON.stringify(this.gameState, null, 2);
  }

  importFromJsonString(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.players) && parsed.ball) {
        this.gameState = parsed;
        this.selectedScenarioName = null;
        this.isDirty = true;
        this.selectedPlayerId = null;
        this.notify("load");
        return true;
      }
    } catch (e) {
      console.error("Failed to parse imported JSON:", e);
    }
    return false;
  }
}

export const gameStateStore = new GameStateStore();
