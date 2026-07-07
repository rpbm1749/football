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
  name?: string; // Optional custom name for the Board (used in Sequences)
}

export interface ScenarioSequenceJSON {
  type: "ScenarioSequence";
  id: string;
  name: string;
  boards: GameStateJSON[];
}

export interface ZoneInfluenceCell {
  col: number;
  row: number;
  x: number; // cell center X
  y: number; // cell center Y
  fastestPlayerA: string | null;
  arrivalTimeA: number;
  fastestPlayerB: string | null;
  arrivalTimeB: number;
  controllingTeam: "A" | "B" | "NONE";
  isContested: boolean;
}

export interface ZoneInfluenceResult {
  cells: ZoneInfluenceCell[][]; // 80 columns x 48 rows
  timestamp: number;
}

export enum ExploitabilityState {
  Defended = "Defended",
  Contested = "Contested",
  Exploitable = "Exploitable",
  Useless = "Useless"
}

export interface ExploitabilityCell {
  state: ExploitabilityState;
  ballArrival: number;
  attackerArrival: number;
  defenderArrival: number;
  attackerId: string | null;
  defenderId: string | null;
}

export interface ExploitabilityResult {
  cells: ExploitabilityCell[][]; // 80 columns x 48 rows
  timestamp: number;
}

export interface PassingTeammateOption {
  playerId: string;
  representativePoint: { x: number; y: number };
  isAerial: boolean;
  hasSafe: boolean;
  safeCells: { col: number; row: number }[];
  riskyCells: { col: number; row: number }[];
}

export interface PassingAnalysisResult {
  options: PassingTeammateOption[];
  timestamp: number;
}

export interface RunningChannelOption {
  playerId: string;
  representativePoint: { x: number; y: number };
  cells: { col: number; row: number }[];
}

export interface RunningChannelsResult {
  channels: RunningChannelOption[];
  timestamp: number;
}

export interface OverloadRegion {
  cells: { col: number; row: number }[];
  representativePoint: { x: number; y: number };
  area: number;
  averageArrivalMargin: number;
  primaryAttackerId: string;
  supportingAttackerId: string;
  primaryDefenderId: string;
}

export interface OverloadAnalysisResult {
  regions: OverloadRegion[];
  timestamp: number;
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
  private currentSequence: ScenarioSequenceJSON | null = null;
  private selectedBoardIndex: number | null = null;
  private activeOverlays: Record<string, boolean> = {
    passLanes: false,
    influenceZone: false,
  };

  // Zone of Influence analysis state
  private showZoneOfInfluence: boolean = false;
  private zoneInfluenceCache: ZoneInfluenceResult | null = null;
  private zoneInfluenceValid: boolean = false;

  // Exploitability analysis state
  private exploitabilityCache: ExploitabilityResult | null = null;
  private exploitabilityValid: boolean = false;

  // Vulnerability analysis state
  private showVulnerability: boolean = false;

  // Passing Analysis state
  private showPassingOptions: boolean = false;
  private showOpponentPassingOptions: boolean = false;
  private passingAnalysisCache: PassingAnalysisResult | null = null;
  private passingAnalysisValid: boolean = false;

  // Running Channels state
  private showAvailableRuns: boolean = false;
  private showOpponentRuns: boolean = false;
  private runningChannelsCache: RunningChannelsResult | null = null;
  private runningChannelsValid: boolean = false;

  // Overload Analysis state
  private showAttackingOverload: boolean = false;
  private showDefensiveOverload: boolean = false;
  private overloadAnalysisCache: OverloadAnalysisResult | null = null;
  private overloadAnalysisValid: boolean = false;

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
    this.zoneInfluenceValid = false; // Invalidate analysis cache on any state mutation
    this.exploitabilityValid = false; // Invalidate exploitability cache on any state mutation
    this.passingAnalysisValid = false; // Invalidate passing analysis cache on any state mutation
    this.runningChannelsValid = false; // Invalidate running channels cache on any state mutation
    this.overloadAnalysisValid = false; // Invalidate overload cache on any state mutation

    // Clone state to trigger react useSyncExternalStore change detection instantly
    this.gameState = {
      ...this.gameState,
      players: this.gameState.players.map((p) => ({ ...p })),
      ball: { ...this.gameState.ball },
    };
    if (this.currentSequence && this.selectedBoardIndex !== null) {
      this.currentSequence.boards[this.selectedBoardIndex] = this.gameState;
    }
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

  getCurrentSequence(): ScenarioSequenceJSON | null {
    return this.currentSequence;
  }

  getSelectedBoardIndex(): number | null {
    return this.selectedBoardIndex;
  }

  getShowZoneOfInfluence(): boolean {
    return this.showZoneOfInfluence;
  }

  toggleZoneOfInfluence(): void {
    this.showZoneOfInfluence = !this.showZoneOfInfluence;
    this.notify("update");
  }

  getShowVulnerability(): boolean {
    return this.showVulnerability;
  }

  toggleVulnerability(): void {
    this.showVulnerability = !this.showVulnerability;
    this.notify("update");
  }

  getShowPassingOptions(): boolean {
    return this.showPassingOptions;
  }

  togglePassingOptions(): void {
    this.showPassingOptions = !this.showPassingOptions;
    this.notify("update");
  }

  getShowOpponentPassingOptions(): boolean {
    return this.showOpponentPassingOptions;
  }

  toggleOpponentPassingOptions(): void {
    this.showOpponentPassingOptions = !this.showOpponentPassingOptions;
    this.notify("update");
  }

  getShowAvailableRuns(): boolean {
    return this.showAvailableRuns;
  }

  toggleAvailableRuns(): void {
    this.showAvailableRuns = !this.showAvailableRuns;
    this.notify("update");
  }

  getShowOpponentRuns(): boolean {
    return this.showOpponentRuns;
  }

  toggleOpponentRuns(): void {
    this.showOpponentRuns = !this.showOpponentRuns;
    this.notify("update");
  }

  getShowAttackingOverload(): boolean {
    return this.showAttackingOverload;
  }

  toggleAttackingOverload(): void {
    this.showAttackingOverload = !this.showAttackingOverload;
    this.notify("update");
  }

  getShowDefensiveOverload(): boolean {
    return this.showDefensiveOverload;
  }

  toggleDefensiveOverload(): void {
    this.showDefensiveOverload = !this.showDefensiveOverload;
    this.notify("update");
  }

  getZoneInfluenceResult(): ZoneInfluenceResult {
    if (!this.zoneInfluenceValid || !this.zoneInfluenceCache) {
      this.zoneInfluenceCache = this.computeZoneInfluence();
      this.zoneInfluenceValid = true;
    }
    return this.zoneInfluenceCache;
  }

  private computeZoneInfluence(): ZoneInfluenceResult {
    const cols = 80;
    const rows = 48;
    const cellW = 100 / cols;
    const cellH = 60 / rows;

    // Find if a team has possession
    let possessionTeam: "A" | "B" | "NONE" = "NONE";
    const possessorId = this.gameState.ball.playerIdWhoHasPossession;
    if (possessorId) {
      const p = this.gameState.players.find((pl) => pl.id === possessorId);
      if (p) {
        possessionTeam = p.team;
      }
    }

    const cells: ZoneInfluenceCell[][] = [];

    for (let c = 0; c < cols; c++) {
      cells[c] = [];
      const cx = (c + 0.5) * cellW;
      for (let r = 0; r < rows; r++) {
        const cy = (r + 0.5) * cellH;

        let minArrivalA = Infinity;
        let fastestA: string | null = null;
        let minArrivalB = Infinity;
        let fastestB: string | null = null;

        // Evaluate every player
        this.gameState.players.forEach((p) => {
          if (p.referee || p.team === "NONE") return;

          const dx = cx - p.x;
          const dy = cy - p.y;
          const dist = Math.hypot(dx, dy);

          // 1. Travel Time (Speed = 8.0 m/s)
          const travelTime = dist / 8.0;

          // 2. Turn Penalty
          let turnPenalty = 0;
          if (dist > 0.01) {
            let targetAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
            if (targetAngle < 0) targetAngle += 360;

            let diff = Math.abs(targetAngle - p.heading_angle);
            diff = diff % 360;
            if (diff > 180) diff = 360 - diff;

            if (diff > 30) {
              const effRad = ((diff - 30) * Math.PI) / 180;
              turnPenalty = 0.25 * Math.sin(effRad / 2);
            }
          }

          // 3. Reaction Tax (0.15 seconds delay for team not in possession)
          let reactionTax = 0;
          if (possessionTeam !== "NONE" && p.team !== possessionTeam) {
            reactionTax = 0.15;
          }

          const arrivalTime = travelTime + turnPenalty + reactionTax;

          if (p.team === "A") {
            if (arrivalTime < minArrivalA) {
              minArrivalA = arrivalTime;
              fastestA = p.id;
            }
          } else if (p.team === "B") {
            if (arrivalTime < minArrivalB) {
              minArrivalB = arrivalTime;
              fastestB = p.id;
            }
          }
        });

        // Contested check (threshold = 0.25 seconds)
        const isContested = Math.abs(minArrivalA - minArrivalB) < 0.25;
        let controllingTeam: "A" | "B" | "NONE" = "NONE";
        if (minArrivalA < minArrivalB) {
          controllingTeam = "A";
        } else if (minArrivalB < minArrivalA) {
          controllingTeam = "B";
        }

        cells[c][r] = {
          col: c,
          row: r,
          x: cx,
          y: cy,
          fastestPlayerA: fastestA,
          arrivalTimeA: minArrivalA,
          fastestPlayerB: fastestB,
          arrivalTimeB: minArrivalB,
          controllingTeam,
          isContested,
        };
      }
    }

    return {
      cells,
      timestamp: Date.now(),
    };
  }

  getExploitabilityResult(): ExploitabilityResult {
    if (!this.exploitabilityValid || !this.exploitabilityCache) {
      this.exploitabilityCache = this.computeExploitability();
      this.exploitabilityValid = true;
    }
    return this.exploitabilityCache;
  }

  getPassingAnalysisResult(): PassingAnalysisResult {
    if (!this.passingAnalysisValid || !this.passingAnalysisCache) {
      this.passingAnalysisCache = this.computePassingAnalysis();
      this.passingAnalysisValid = true;
    }
    return this.passingAnalysisCache;
  }

  getRunningChannelsResult(): RunningChannelsResult {
    if (!this.runningChannelsValid || !this.runningChannelsCache) {
      this.runningChannelsCache = this.computeRunningChannels();
      this.runningChannelsValid = true;
    }
    return this.runningChannelsCache;
  }

  getOverloadAnalysisResult(): OverloadAnalysisResult {
    if (!this.overloadAnalysisValid || !this.overloadAnalysisCache) {
      this.overloadAnalysisCache = this.computeOverloadAnalysis();
      this.overloadAnalysisValid = true;
    }
    return this.overloadAnalysisCache;
  }

  private computeOverloadAnalysis(): OverloadAnalysisResult {
    const exploitability = this.getExploitabilityResult();

    const cols = 80;
    const rows = 48;
    const cellW = 100 / cols;
    const cellH = 60 / rows;

    // Resolve Attacking vs Defending team dynamically based on ball possession
    let attackingTeam: "A" | "B" = "A";
    let defendingTeam: "A" | "B" = "B";

    const possessorId = this.gameState.ball.playerIdWhoHasPossession;
    if (possessorId) {
      const p = this.gameState.players.find((pl) => pl.id === possessorId);
      if (p) {
        if (p.team === "B") {
          attackingTeam = "B";
          defendingTeam = "A";
        }
      }
    }

    // Sort defending team's players by x-coordinate to find the offside line
    const defenderXs = this.gameState.players
      .filter((p) => p.team === defendingTeam && !p.referee)
      .map((p) => p.x)
      .sort((a, b) => a - b);

    const bx = this.gameState.ball.x;
    const offsidePlayerIds = new Set<string>();

    let offsideLineX = 0;
    if (defendingTeam === "A") {
      if (defenderXs.length >= 2) {
        offsideLineX = defenderXs[1];
      } else if (defenderXs.length === 1) {
        offsideLineX = defenderXs[0];
      }

      this.gameState.players.forEach((p) => {
        if (p.team === attackingTeam && !p.referee) {
          if (p.x < 50.0 && p.x < offsideLineX && p.x < bx) {
            offsidePlayerIds.add(p.id);
          }
        }
      });
    } else {
      offsideLineX = 100;
      const n = defenderXs.length;
      if (n >= 2) {
        offsideLineX = defenderXs[n - 2];
      } else if (n === 1) {
        offsideLineX = defenderXs[0];
      }

      this.gameState.players.forEach((p) => {
        if (p.team === attackingTeam && !p.referee) {
          if (p.x > 50.0 && p.x > offsideLineX && p.x > bx) {
            offsidePlayerIds.add(p.id);
          }
        }
      });
    }

    const activeCells: {
      col: number;
      row: number;
      cx: number;
      cy: number;
      a1: string;
      a2: string;
      d1: string;
      margin: number;
    }[] = [];

    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * cellW;

      // 1. Spatial Constraint:
      // Attacking Overload (A has possession): x >= 66.67
      // Defensive Overload (B has possession): x <= 33.33
      if (attackingTeam === "A" && cx < 66.67) continue;
      if (attackingTeam === "B" && cx > 33.33) continue;

      for (let r = 0; r < rows; r++) {
        const cy = (r + 0.5) * cellH;
        const expCell = exploitability.cells[c][r];

        // 2. Tactical Constraint: Exploitable or Contested
        if (expCell.state !== ExploitabilityState.Exploitable && expCell.state !== ExploitabilityState.Contested) {
          continue;
        }

        // Calculate arrival times for all attackers and defenders
        const attackers: { id: string; t: number }[] = [];
        const defenders: { id: string; t: number }[] = [];

        this.gameState.players.forEach((p) => {
          if (p.referee || p.team === "NONE") return;
          if (possessorId && p.id === possessorId) return;
          if (p.team === attackingTeam && offsidePlayerIds.has(p.id)) return;

          const dx = cx - p.x;
          const dy = cy - p.y;
          const dist = Math.hypot(dx, dy);

          const travelTime = dist / 8.0;

          let turnPenalty = 0;
          if (dist > 0.01) {
            let targetAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
            if (targetAngle < 0) targetAngle += 360;

            let diff = Math.abs(targetAngle - p.heading_angle);
            diff = diff % 360;
            if (diff > 180) diff = 360 - diff;

            if (diff > 30) {
              const effRad = ((diff - 30) * Math.PI) / 180;
              turnPenalty = 0.25 * Math.sin(effRad / 2);
            }
          }

          let reactionTax = 0;
          if (possessorId && p.team === defendingTeam) {
            reactionTax = 0.15;
          }

          const arrivalTime = travelTime + turnPenalty + reactionTax;

          if (p.team === attackingTeam) {
            attackers.push({ id: p.id, t: arrivalTime });
          } else {
            defenders.push({ id: p.id, t: arrivalTime });
          }
        });

        if (attackers.length < 2 || defenders.length < 2) continue;

        attackers.sort((a, b) => a.t - b.t);
        defenders.sort((a, b) => a.t - b.t);

        const tA2 = attackers[1].t;
        const tD2 = defenders[1].t;

        // 3. Overload Condition: T_A2 + 0.5 < T_D2
        if (tA2 + 0.5 < tD2) {
          activeCells.push({
            col: c,
            row: r,
            cx,
            cy,
            a1: attackers[0].id,
            a2: attackers[1].id,
            d1: defenders[0].id,
            margin: tD2 - tA2,
          });
        }
      }
    }

    const regions: OverloadRegion[] = [];
    if (activeCells.length === 0) {
      return { regions, timestamp: Date.now() };
    }

    // Group active cells using 8-connectivity CCA
    const activeMap = Array.from({ length: cols }, () => new Uint8Array(rows));
    activeCells.forEach(cell => activeMap[cell.col][cell.row] = 1);

    const visited = Array.from({ length: cols }, () => new Uint8Array(rows));

    for (const startCell of activeCells) {
      if (!visited[startCell.col][startCell.row]) {
        const component: typeof activeCells = [];
        const queue: [number, number][] = [[startCell.col, startCell.row]];
        visited[startCell.col][startCell.row] = 1;

        while (queue.length > 0) {
          const [cc, cr] = queue.shift()!;
          const match = activeCells.find(cell => cell.col === cc && cell.row === cr);
          if (match) component.push(match);

          for (let dc = -1; dc <= 1; dc++) {
            for (let dr = -1; dr <= 1; dr++) {
              if (dc === 0 && dr === 0) continue;
              const nc = cc + dc;
              const nr = cr + dr;
              if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
                if (activeMap[nc][nr] > 0 && !visited[nc][nr]) {
                  visited[nc][nr] = 1;
                  queue.push([nc, nr]);
                }
              }
            }
          }
        }

        // Filter components: size >= 9 cells
        if (component.length >= 9) {
          let sumX = 0;
          let sumY = 0;
          let sumMargin = 0;
          const a1Freq: Record<string, number> = {};
          const a2Freq: Record<string, number> = {};
          const d1Freq: Record<string, number> = {};

          component.forEach(c => {
            sumX += c.cx;
            sumY += c.cy;
            sumMargin += c.margin;
            a1Freq[c.a1] = (a1Freq[c.a1] || 0) + 1;
            a2Freq[c.a2] = (a2Freq[c.a2] || 0) + 1;
            d1Freq[c.d1] = (d1Freq[c.d1] || 0) + 1;
          });

          const primaryAttackerId = Object.keys(a1Freq).reduce((a, b) => a1Freq[a] > a1Freq[b] ? a : b);
          const supportingAttackerId = Object.keys(a2Freq).reduce((a, b) => a2Freq[a] > a2Freq[b] ? a : b);
          const primaryDefenderId = Object.keys(d1Freq).reduce((a, b) => d1Freq[a] > d1Freq[b] ? a : b);

          regions.push({
            cells: component.map(c => ({ col: c.col, row: c.row })),
            representativePoint: { x: sumX / component.length, y: sumY / component.length },
            area: component.length * cellW * cellH,
            averageArrivalMargin: sumMargin / component.length,
            primaryAttackerId,
            supportingAttackerId,
            primaryDefenderId,
          });
        }
      }
    }

    return {
      regions,
      timestamp: Date.now(),
    };
  }

  private computeRunningChannels(): RunningChannelsResult {
    const exploitability = this.getExploitabilityResult();

    const cols = 80;
    const rows = 48;
    const cellW = 100 / cols;
    const cellH = 60 / rows;

    // Resolve Attacking vs Defending team dynamically based on ball possession
    let attackingTeam: "A" | "B" = "A";
    let defendingTeam: "A" | "B" = "B";

    const possessorId = this.gameState.ball.playerIdWhoHasPossession;
    if (possessorId) {
      const p = this.gameState.players.find((pl) => pl.id === possessorId);
      if (p) {
        if (p.team === "B") {
          attackingTeam = "B";
          defendingTeam = "A";
        }
      }
    }

    // Sort defending team's players by x-coordinate to find the offside line
    const defenderXs = this.gameState.players
      .filter((p) => p.team === defendingTeam && !p.referee)
      .map((p) => p.x)
      .sort((a, b) => a - b);

    const bx = this.gameState.ball.x;
    const offsidePlayerIds = new Set<string>();

    let offsideLineX = 0;
    if (defendingTeam === "A") {
      if (defenderXs.length >= 2) {
        offsideLineX = defenderXs[1];
      } else if (defenderXs.length === 1) {
        offsideLineX = defenderXs[0];
      }

      this.gameState.players.forEach((p) => {
        if (p.team === attackingTeam && !p.referee) {
          if (p.x < 50.0 && p.x < offsideLineX && p.x < bx) {
            offsidePlayerIds.add(p.id);
          }
        }
      });
    } else {
      offsideLineX = 100;
      const n = defenderXs.length;
      if (n >= 2) {
        offsideLineX = defenderXs[n - 2];
      } else if (n === 1) {
        offsideLineX = defenderXs[0];
      }

      this.gameState.players.forEach((p) => {
        if (p.team === attackingTeam && !p.referee) {
          if (p.x > 50.0 && p.x > offsideLineX && p.x > bx) {
            offsidePlayerIds.add(p.id);
          }
        }
      });
    }

    // Calculate the back-line defensive reference line (average of 4 deepest outfield defenders)
    const outfieldDefenders = this.gameState.players
      .filter((p) => p.team === defendingTeam && !p.referee && !p.goalkeeper)
      .map((p) => p.x)
      .sort((a, b) => a - b);

    let defensiveLineX = 0;
    if (defendingTeam === "A") {
      // Deepest Team A defenders are smallest X values (defending left)
      const deepest = outfieldDefenders.slice(0, 4);
      if (deepest.length > 0) {
        defensiveLineX = deepest.reduce((sum, val) => sum + val, 0) / deepest.length;
      }
    } else {
      // Deepest Team B defenders are largest X values (defending right)
      const deepest = outfieldDefenders.slice().reverse().slice(0, 4);
      if (deepest.length > 0) {
        defensiveLineX = deepest.reduce((sum, val) => sum + val, 0) / deepest.length;
      }
    }

    // Eligible players: outfield attacking players, in opponent's half, not in possession, not offside
    const eligiblePlayers = this.gameState.players.filter((p) => {
      if (p.referee || p.team !== attackingTeam) return false;
      if (p.id === possessorId) return false;
      if (offsidePlayerIds.has(p.id)) return false;

      if (attackingTeam === "A") {
        return p.x > 50.0; // Opponent's half for Team A (attacking right)
      } else {
        return p.x < 50.0; // Opponent's half for Team B (attacking left)
      }
    });

    const channels: RunningChannelOption[] = [];

    eligiblePlayers.forEach((player) => {
      const activeCells: { col: number; row: number; cx: number; cy: number }[] = [];

      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) * cellW;
        for (let r = 0; r < rows; r++) {
          const cy = (r + 0.5) * cellH;
          const expCell = exploitability.cells[c][r];

          // 1. Must be Exploitable by this player
          if (expCell.state !== ExploitabilityState.Exploitable || expCell.attackerId !== player.id) {
            continue;
          }

          // 2. Must be ahead of player along attacking direction
          // 3. Must be within 45-degree forward cone
          // 4. Must break defensive line (ahead of defensiveLineX)
          if (attackingTeam === "A") {
            if (cx <= player.x) continue;
            if (Math.abs(cy - player.y) > Math.abs(cx - player.x)) continue;
            if (cx <= defensiveLineX) continue;
          } else {
            if (cx >= player.x) continue;
            if (Math.abs(cy - player.y) > Math.abs(cx - player.x)) continue;
            if (cx >= defensiveLineX) continue;
          }

          activeCells.push({ col: c, row: r, cx, cy });
        }
      }

      if (activeCells.length === 0) return;

      // Group active cells using 8-connectivity CCA
      const activeMap = Array.from({ length: cols }, () => new Uint8Array(rows));
      activeCells.forEach(cell => activeMap[cell.col][cell.row] = 1);

      const visited = Array.from({ length: cols }, () => new Uint8Array(rows));
      const validComponents: { cells: { col: number; row: number; cx: number; cy: number }[]; depth: number }[] = [];

      for (const startCell of activeCells) {
        if (!visited[startCell.col][startCell.row]) {
          const component: { col: number; row: number; cx: number; cy: number }[] = [];
          const queue: [number, number][] = [[startCell.col, startCell.row]];
          visited[startCell.col][startCell.row] = 1;

          while (queue.length > 0) {
            const [cc, cr] = queue.shift()!;
            const cxVal = (cc + 0.5) * cellW;
            const cyVal = (cr + 0.5) * cellH;
            component.push({ col: cc, row: cr, cx: cxVal, cy: cyVal });

            for (let dc = -1; dc <= 1; dc++) {
              for (let dr = -1; dr <= 1; dr++) {
                if (dc === 0 && dr === 0) continue;
                const nc = cc + dc;
                const nr = cr + dr;
                if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
                  if (activeMap[nc][nr] > 0 && !visited[nc][nr]) {
                    visited[nc][nr] = 1;
                    queue.push([nc, nr]);
                  }
                }
              }
            }
          }

          // Filter components: size >= 6 and depth >= 5.0 meters
          if (component.length >= 6) {
            let minX = Infinity;
            let maxX = -Infinity;
            component.forEach(c => {
              if (c.cx < minX) minX = c.cx;
              if (c.cx > maxX) maxX = c.cx;
            });
            const depth = maxX - minX;
            if (depth >= 5.0) {
              validComponents.push({ cells: component, depth });
            }
          }
        }
      }

      // If valid channels exist, choose the deepest one
      if (validComponents.length > 0) {
        validComponents.sort((a, b) => b.depth - a.depth);
        const bestComp = validComponents[0];

        let deepestCell = bestComp.cells[0];
        bestComp.cells.forEach(c => {
          if (attackingTeam === "A") {
            if (c.cx > deepestCell.cx) {
              deepestCell = c;
            }
          } else {
            if (c.cx < deepestCell.cx) {
              deepestCell = c;
            }
          }
        });

        channels.push({
          playerId: player.id,
          representativePoint: { x: deepestCell.cx, y: deepestCell.cy },
          cells: bestComp.cells.map(c => ({ col: c.col, row: c.row })),
        });
      }
    });

    return {
      channels,
      timestamp: Date.now(),
    };
  }

  private computePassingAnalysis(): PassingAnalysisResult {
    const exploitability = this.getExploitabilityResult();
    const zoneInfluence = this.getZoneInfluenceResult();

    const cols = 80;
    const rows = 48;
    const cellW = 100 / cols;
    const cellH = 60 / rows;

    // Resolve Attacking vs Defending team dynamically based on ball possession
    let attackingTeam: "A" | "B" = "A";
    let defendingTeam: "A" | "B" = "B";

    const possessorId = this.gameState.ball.playerIdWhoHasPossession;
    if (possessorId) {
      const p = this.gameState.players.find((pl) => pl.id === possessorId);
      if (p) {
        if (p.team === "B") {
          attackingTeam = "B";
          defendingTeam = "A";
        }
      }
    }

    const bx = this.gameState.ball.x;
    const by = this.gameState.ball.y;

    // Teammates: outfield players on the attacking team (excluding the ball possessor)
    const teammates = this.gameState.players.filter(
      (p) => p.team === attackingTeam && !p.referee && p.id !== possessorId
    );

    const options: PassingTeammateOption[] = [];

    // For each teammate, find their receiving regions and compute centroid target
    teammates.forEach((player) => {
      const safeCells: { col: number; row: number }[] = [];
      const riskyCells: { col: number; row: number }[] = [];

      // Grid coordinate mapping
      // 1. Identify which cells belong to this player under the criteria:
      // - Safe: Exploitability is Exploitable and attackerId === player.id
      // - Risky: Exploitability is Contested AND zoneInfluenceCell is uncontested for attacking team and belongs to player
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const expCell = exploitability.cells[c][r];
          const ziCell = zoneInfluence.cells[c][r];

          if (expCell.state === ExploitabilityState.Exploitable && expCell.attackerId === player.id) {
            safeCells.push({ col: c, row: r });
          } else if (expCell.state === ExploitabilityState.Contested) {
            const ziControllingTeam = ziCell.controllingTeam;
            const ziFastestAttackerId = attackingTeam === "A" ? ziCell.fastestPlayerA : ziCell.fastestPlayerB;
            if (!ziCell.isContested && ziControllingTeam === attackingTeam && ziFastestAttackerId === player.id) {
              riskyCells.push({ col: c, row: r });
            }
          }
        }
      }

      // Combine cells for connected-component analysis (CCA)
      const activeCellsMap = Array.from({ length: cols }, () => new Uint8Array(rows));
      safeCells.forEach(cell => activeCellsMap[cell.col][cell.row] = 1); // 1 = Safe
      riskyCells.forEach(cell => activeCellsMap[cell.col][cell.row] = 2); // 2 = Risky

      // Step 2: CCA on combined active cells (8-connectivity)
      const visited = Array.from({ length: cols }, () => new Uint8Array(rows));
      const validSafeCells: { col: number; row: number }[] = [];
      const validRiskyCells: { col: number; row: number }[] = [];
      let totalX = 0;
      let totalY = 0;
      let totalCount = 0;

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (activeCellsMap[c][r] > 0 && !visited[c][r]) {
            const component: { col: number; row: number; type: number }[] = [];
            const queue: [number, number][] = [[c, r]];
            visited[c][r] = 1;

            while (queue.length > 0) {
              const curr = queue.shift()!;
              const [cc, cr] = curr;
              component.push({ col: cc, row: cr, type: activeCellsMap[cc][cr] });

              for (let dc = -1; dc <= 1; dc++) {
                for (let dr = -1; dr <= 1; dr++) {
                  if (dc === 0 && dr === 0) continue;
                  const nc = cc + dc;
                  const nr = cr + dr;
                  if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
                    if (activeCellsMap[nc][nr] > 0 && !visited[nc][nr]) {
                      visited[nc][nr] = 1;
                      queue.push([nc, nr]);
                    }
                  }
                }
              }
            }

            // Only keep components with size >= 6
            if (component.length >= 6) {
              component.forEach((cell) => {
                const cx = (cell.col + 0.5) * cellW;
                const cy = (cell.row + 0.5) * cellH;
                totalX += cx;
                totalY += cy;
                totalCount++;

                if (cell.type === 1) {
                  validSafeCells.push({ col: cell.col, row: cell.row });
                } else {
                  validRiskyCells.push({ col: cell.col, row: cell.row });
                }
              });
            }
          }
        }
      }

      // If teammate has at least one valid receiving region, compute centroid target and check pass block
      if (totalCount > 0) {
        const repX = totalX / totalCount;
        const repY = totalY / totalCount;

        // Determine if ground pass to the representative point (centroid) is blocked
        let isAerial = false;
        const dxBall = repX - bx;
        const dyBall = repY - by;
        const passDist = Math.hypot(dxBall, dyBall);

        if (passDist > 0.1) {
          const vx = repX - bx;
          const vy = repY - by;
          const lenSq = vx * vx + vy * vy;

          for (const p of this.gameState.players) {
            if (p.referee || p.team !== defendingTeam) continue;

            const dxProj = p.x - bx;
            const dyProj = p.y - by;
            const u = Math.max(0.0, Math.min(1.0, (dxProj * vx + dyProj * vy) / lenSq));
            if (u > 0.85) continue;

            const pxProj = bx + u * vx;
            const pyProj = by + u * vy;

            const distToProj = Math.hypot(p.x - pxProj, p.y - pyProj);
            const distFromBallToProj = Math.hypot(pxProj - bx, pyProj - by);

            const speedAtProj = 8.0 + 0.3 * passDist;
            const tBallProj = distFromBallToProj / speedAtProj;
            const tTravelDef = distToProj / 8.0;

            let turnPenaltyDef = 0;
            if (distToProj > 0.01) {
              let targetAngle = (Math.atan2(pyProj - p.y, pxProj - p.x) * 180) / Math.PI;
              if (targetAngle < 0) targetAngle += 360;

              let angleDiff = Math.abs(targetAngle - p.heading_angle) % 360;
              if (angleDiff > 180) angleDiff = 360 - angleDiff;

              if (angleDiff > 30) {
                const effRad = ((angleDiff - 30) * Math.PI) / 180;
                turnPenaltyDef = 0.25 * Math.sin(effRad / 2);
              }
            }

            const tDefProj = tTravelDef + turnPenaltyDef + 0.15;
            if (tDefProj <= tBallProj) {
              isAerial = true;
              break;
            }
          }
        }

        options.push({
          playerId: player.id,
          representativePoint: { x: repX, y: repY },
          isAerial,
          hasSafe: validSafeCells.length > 0,
          safeCells: validSafeCells,
          riskyCells: validRiskyCells,
        });
      }
    });

    return {
      options,
      timestamp: Date.now(),
    };
  }

  private computeExploitability(): ExploitabilityResult {
    const cols = 80;
    const rows = 48;
    const cellW = 100 / cols;
    const cellH = 60 / rows;

    // Resolve Attacking vs Defending team dynamically based on ball possession
    let attackingTeam: "A" | "B" = "A";
    let defendingTeam: "A" | "B" = "B";

    const possessorId = this.gameState.ball.playerIdWhoHasPossession;
    if (possessorId) {
      const p = this.gameState.players.find((pl) => pl.id === possessorId);
      if (p) {
        if (p.team === "B") {
          attackingTeam = "B";
          defendingTeam = "A";
        }
      }
    }

    // Pre-calculate offside player IDs
    const offsidePlayerIds = new Set<string>();
    const defenderXs = this.gameState.players
      .filter((p) => p.team === defendingTeam && !p.referee)
      .map((p) => p.x)
      .sort((a, b) => a - b);

    const bxForOffside = this.gameState.ball.x;

    if (defendingTeam === "A") {
      // Team A defends left goal (x=0). Offside is smaller X (towards left).
      let offsideLineX = 0;
      if (defenderXs.length >= 2) {
        offsideLineX = defenderXs[1];
      } else if (defenderXs.length === 1) {
        offsideLineX = defenderXs[0];
      }

      this.gameState.players.forEach((p) => {
        if (p.team === attackingTeam && !p.referee) {
          if (p.x < 50.0 && p.x < offsideLineX && p.x < bxForOffside) {
            offsidePlayerIds.add(p.id);
          }
        }
      });
    } else {
      // Team B defends right goal (x=100). Offside is larger X (towards right).
      let offsideLineX = 100;
      const n = defenderXs.length;
      if (n >= 2) {
        offsideLineX = defenderXs[n - 2];
      } else if (n === 1) {
        offsideLineX = defenderXs[0];
      }

      this.gameState.players.forEach((p) => {
        if (p.team === attackingTeam && !p.referee) {
          if (p.x > 50.0 && p.x > offsideLineX && p.x > bxForOffside) {
            offsidePlayerIds.add(p.id);
          }
        }
      });
    }

    const cells: ExploitabilityCell[][] = [];

    for (let c = 0; c < cols; c++) {
      cells[c] = [];
      const cx = (c + 0.5) * cellW;
      for (let r = 0; r < rows; r++) {
        const cy = (r + 0.5) * cellH;

        // Ball arrival time (Dynamic Average Speed Model: V_avg = 8.0 + 0.3 * distance)
        const dxBall = cx - this.gameState.ball.x;
        const dyBall = cy - this.gameState.ball.y;
        const ballDist = Math.hypot(dxBall, dyBall);
        const ballSpeed = 8.0 + 0.3 * ballDist;
        const ballArrival = ballDist / ballSpeed;

        const bx = this.gameState.ball.x;
        const by = this.gameState.ball.y;

        // Step 1: Check if ground pass is intercepted along the lane segment BC by any defender
        let groundPassBlocked = false;
        if (ballDist > 0.1) {
          const vx = cx - bx;
          const vy = cy - by;
          const lenSq = vx * vx + vy * vy;

          for (const p of this.gameState.players) {
            if (p.referee || p.team !== defendingTeam) continue;

            const dxProj = p.x - bx;
            const dyProj = p.y - by;
            const u = Math.max(0.0, Math.min(1.0, (dxProj * vx + dyProj * vy) / lenSq));
            if (u > 0.85) continue;

            const pxProj = bx + u * vx;
            const pyProj = by + u * vy;

            const distToProj = Math.hypot(p.x - pxProj, p.y - pyProj);
            const distFromBallToProj = Math.hypot(pxProj - bx, pyProj - by);

            const speedAtProj = 8.0 + 0.3 * distFromBallToProj;
            const tBallProj = distFromBallToProj / speedAtProj;

            const tTravelDef = distToProj / 8.0;

            let turnPenaltyDef = 0;
            if (distToProj > 0.01) {
              let targetAngle = (Math.atan2(pyProj - p.y, pxProj - p.x) * 180) / Math.PI;
              if (targetAngle < 0) targetAngle += 360;

              let angleDiff = Math.abs(targetAngle - p.heading_angle) % 360;
              if (angleDiff > 180) angleDiff = 360 - angleDiff;

              if (angleDiff > 30) {
                const effRad = ((angleDiff - 30) * Math.PI) / 180;
                turnPenaltyDef = 0.25 * Math.sin(effRad / 2);
              }
            }

            const tDefProj = tTravelDef + turnPenaltyDef + 0.15;

            if (tDefProj <= tBallProj) {
              groundPassBlocked = true;
              break;
            }
          }
        }

        // Step 2: Handle transition to Aerial Pass if ground pass is blocked
        let finalBallArrival = ballArrival;
        let passIntercepted = false;

        if (groundPassBlocked) {
          // Check if a close defender blocks the lofted release (within 2.5 meters of the ball)
          const closeDefender = this.gameState.players.find(
            (p) =>
              p.team === defendingTeam &&
              !p.referee &&
              Math.hypot(p.x - bx, p.y - by) <= 2.5
          );

          if (closeDefender) {
            passIntercepted = true;
          } else {
            // Apply +0.25s aerial hang-time tax
            finalBallArrival = ballArrival + 0.25;
          }
        }

        // If the pass is intercepted (blocked at source or ground intercepted with no aerial lift possible),
        // it is immediately classified as Defended
        if (passIntercepted) {
          cells[c][r] = {
            state: ExploitabilityState.Defended,
            ballArrival: finalBallArrival,
            attackerArrival: Infinity,
            defenderArrival: 0,
            attackerId: null,
            defenderId: null,
          };
          continue;
        }

        let attackerArrival = Infinity;
        let attackerId: string | null = null;
        let defenderArrival = Infinity;
        let defenderId: string | null = null;

        // Evaluate every player using the arrival-time physics model
        this.gameState.players.forEach((p) => {
          if (p.referee || p.team === "NONE") return;
          // Exclude the player currently in possession of the ball (the passer cannot receive the pass)
          if (possessorId && p.id === possessorId) return;
          // Exclude offside attacking players
          if (p.team === attackingTeam && offsidePlayerIds.has(p.id)) return;

          const dx = cx - p.x;
          const dy = cy - p.y;
          const dist = Math.hypot(dx, dy);

          // 1. Travel Time (Speed = 8.0 m/s)
          const travelTime = dist / 8.0;

          // 2. Turn Penalty
          let turnPenalty = 0;
          if (dist > 0.01) {
            let targetAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
            if (targetAngle < 0) targetAngle += 360;

            let diff = Math.abs(targetAngle - p.heading_angle);
            diff = diff % 360;
            if (diff > 180) diff = 360 - diff;

            if (diff > 30) {
              const effRad = ((diff - 30) * Math.PI) / 180;
              turnPenalty = 0.25 * Math.sin(effRad / 2);
            }
          }

          // 3. Reaction Tax (0.15s delay for defending team)
          let reactionTax = 0;
          if (possessorId && p.team === defendingTeam) {
            reactionTax = 0.15;
          }

          const arrivalTime = travelTime + turnPenalty + reactionTax;

          if (p.team === attackingTeam) {
            if (arrivalTime < attackerArrival) {
              attackerArrival = arrivalTime;
              attackerId = p.id;
            }
          } else if (p.team === defendingTeam) {
            if (arrivalTime < defenderArrival) {
              defenderArrival = arrivalTime;
              defenderId = p.id;
            }
          }
        });

        // Refined Partition Logic
        let state: ExploitabilityState;

        if (attackerArrival > finalBallArrival && defenderArrival > finalBallArrival) {
          state = ExploitabilityState.Useless;
        } else if (defenderArrival > finalBallArrival && attackerArrival <= finalBallArrival) {
          state = ExploitabilityState.Exploitable;
        } else if (defenderArrival <= finalBallArrival) {
          if (defenderArrival <= attackerArrival) {
            state = ExploitabilityState.Defended;
          } else {
            // Both are before the ball, attacker is first.
            // Check if defender is close behind (< 0.5 seconds)
            if (defenderArrival - attackerArrival < 0.5) {
              state = ExploitabilityState.Contested;
            } else {
              state = ExploitabilityState.Exploitable;
            }
          }
        } else {
          state = ExploitabilityState.Useless;
        }

        cells[c][r] = {
          state,
          ballArrival: finalBallArrival,
          attackerArrival,
          defenderArrival,
          attackerId,
          defenderId,
        };
      }
    }

    return {
      cells,
      timestamp: Date.now(),
    };
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

  // --- Scenario Sequence Mutators ---
  newSequence(name: string): void {
    this.currentSequence = {
      type: "ScenarioSequence",
      id: `seq_${Date.now()}`,
      name: name || "New Sequence",
      boards: [],
    };
    this.selectedBoardIndex = null;
    this.isDirty = true;
    this.notify("load");
  }

  addCurrentBoardToSequence(): void {
    if (!this.currentSequence) return;
    
    // Deep copy the current board state to ensure independence
    const copiedBoard: GameStateJSON = {
      name: `State ${this.currentSequence.boards.length + 1}`,
      players: this.gameState.players.map((p) => ({ ...p })),
      ball: { ...this.gameState.ball },
    };
    
    this.currentSequence.boards.push(copiedBoard);
    this.selectedBoardIndex = this.currentSequence.boards.length - 1;
    this.gameState = copiedBoard;
    this.isDirty = true;
    this.notify("load");
  }

  selectSequenceBoard(index: number): void {
    if (!this.currentSequence || index < 0 || index >= this.currentSequence.boards.length) return;
    this.selectedBoardIndex = index;
    this.gameState = this.currentSequence.boards[index];
    this.selectedPlayerId = null;
    this.notify("load");
  }

  deleteSequenceBoard(index: number): void {
    if (!this.currentSequence || index < 0 || index >= this.currentSequence.boards.length) return;
    this.currentSequence.boards.splice(index, 1);
    
    if (this.currentSequence.boards.length === 0) {
      this.selectedBoardIndex = null;
      this.gameState = createDefaultGameState();
    } else {
      const nextIndex = Math.max(0, Math.min(index, this.currentSequence.boards.length - 1));
      this.selectedBoardIndex = nextIndex;
      this.gameState = this.currentSequence.boards[nextIndex];
    }
    this.isDirty = true;
    this.notify("load");
  }

  duplicateSequenceBoard(index: number): void {
    if (!this.currentSequence || index < 0 || index >= this.currentSequence.boards.length) return;
    const original = this.currentSequence.boards[index];
    
    const duplicate: GameStateJSON = {
      name: original.name ? `${original.name} (Copy)` : `State ${index + 1} (Copy)`,
      players: original.players.map((p) => ({ ...p })),
      ball: { ...original.ball },
    };
    
    this.currentSequence.boards.splice(index + 1, 0, duplicate);
    this.selectedBoardIndex = index + 1;
    this.gameState = duplicate;
    this.isDirty = true;
    this.notify("load");
  }

  moveSequenceBoard(index: number, direction: "up" | "down"): void {
    if (!this.currentSequence) return;
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= this.currentSequence.boards.length) return;
    
    const temp = this.currentSequence.boards[index];
    this.currentSequence.boards[index] = this.currentSequence.boards[newIndex];
    this.currentSequence.boards[newIndex] = temp;
    
    if (this.selectedBoardIndex === index) {
      this.selectedBoardIndex = newIndex;
    } else if (this.selectedBoardIndex === newIndex) {
      this.selectedBoardIndex = index;
    }
    this.isDirty = true;
    this.notify("load");
  }

  renameSequenceBoard(index: number, newName: string): void {
    if (!this.currentSequence || index < 0 || index >= this.currentSequence.boards.length) return;
    this.currentSequence.boards[index].name = newName;
    this.isDirty = true;
    this.notify("update");
  }

  renameSequence(newName: string): void {
    if (!this.currentSequence) return;
    this.currentSequence.name = newName;
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
        if (data && data.type === "ScenarioSequence") {
          this.currentSequence = data;
          if (data.boards.length > 0) {
            this.selectedBoardIndex = 0;
            this.gameState = data.boards[0];
          } else {
            this.selectedBoardIndex = null;
            this.gameState = createDefaultGameState();
          }
        } else {
          this.currentSequence = null;
          this.selectedBoardIndex = null;
          this.gameState = data;
        }
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
    this.currentSequence = null;
    this.selectedBoardIndex = null;
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
      const payload = this.currentSequence ? this.currentSequence : this.gameState;
      const response = await fetch(`/api/scenarios/${filename}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload, null, 2),
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
    const payload = this.currentSequence ? this.currentSequence : this.gameState;
    return JSON.stringify(payload, null, 2);
  }

  importFromJsonString(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed && typeof parsed === "object") {
        if (parsed.type === "ScenarioSequence") {
          this.currentSequence = parsed;
          if (parsed.boards.length > 0) {
            this.selectedBoardIndex = 0;
            this.gameState = parsed.boards[0];
          } else {
            this.selectedBoardIndex = null;
            this.gameState = createDefaultGameState();
          }
          this.selectedScenarioName = null;
          this.isDirty = true;
          this.selectedPlayerId = null;
          this.notify("load");
          return true;
        } else if (Array.isArray(parsed.players) && parsed.ball) {
          this.currentSequence = null;
          this.selectedBoardIndex = null;
          this.gameState = parsed;
          this.selectedScenarioName = null;
          this.isDirty = true;
          this.selectedPlayerId = null;
          this.notify("load");
          return true;
        }
      }
    } catch (e) {
      console.error("Failed to parse imported JSON:", e);
    }
    return false;
  }

  getTacticalAnalysisPayload(mode: "current" | "sequence"): any {
    const originalState = this.gameState;
    const frames: any[] = [];

    if (mode === "sequence" && this.currentSequence && this.currentSequence.boards.length > 0) {
      this.currentSequence.boards.forEach((board, idx) => {
        frames.push(this.extractTacticalMetricsForState(board, idx));
      });
    } else {
      frames.push(this.extractTacticalMetricsForState(this.gameState, 0));
    }

    // Restore original state and invalidate caches to clean up
    this.gameState = originalState;
    this.zoneInfluenceValid = false;
    this.exploitabilityValid = false;
    this.passingAnalysisValid = false;
    this.runningChannelsValid = false;
    this.overloadAnalysisValid = false;

    return {
      boardCount: frames.length,
      frames
    };
  }

  private extractTacticalMetricsForState(state: GameStateJSON, frameIndex: number): any {
    this.gameState = state;
    this.zoneInfluenceValid = false;
    this.exploitabilityValid = false;
    this.passingAnalysisValid = false;
    this.runningChannelsValid = false;
    this.overloadAnalysisValid = false;

    // Resolve Attacking vs Defending team dynamically based on ball possession
    let attackingTeam: "A" | "B" = "A";
    const possessorId = state.ball.playerIdWhoHasPossession;
    if (possessorId) {
      const p = state.players.find((pl: any) => pl.id === possessorId);
      if (p) {
        if (p.team === "B") {
          attackingTeam = "B";
        }
      }
    }

    const teamAPhase = (attackingTeam === "A") ? "attacking" : "defending";

    const cols = 80;
    const rows = 48;
    const cellW = 100 / cols;
    const cellH = 60 / rows;

    // 1. Zone of Influence
    const influence = this.getZoneInfluenceResult();
    let defThird = { teamA: 0, teamB: 0, contested: 0 };
    let midThird = { teamA: 0, teamB: 0, contested: 0 };
    let attThird = { teamA: 0, teamB: 0, contested: 0 };

    let overallTeamA = 0;
    let overallTeamB = 0;
    let overallContested = 0;

    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * cellW;
      let third: "def" | "mid" | "att";
      if (attackingTeam === "A") {
        if (cx < 33.33) third = "def";
        else if (cx < 66.67) third = "mid";
        else third = "att";
      } else {
        if (cx >= 66.67) third = "def";
        else if (cx >= 33.33) third = "mid";
        else third = "att";
      }

      for (let r = 0; r < rows; r++) {
        const cell = influence.cells[c][r];
        const target = third === "def" ? defThird : third === "mid" ? midThird : attThird;
        if (cell.controllingTeam === "A") {
          target.teamA++;
          overallTeamA++;
        } else if (cell.controllingTeam === "B") {
          target.teamB++;
          overallTeamB++;
        } else {
          target.contested++;
          overallContested++;
        }
      }
    }

    const thirdsPct = (third: typeof defThird) => {
      const total = third.teamA + third.teamB + third.contested || 1;
      return {
        teamA: Math.round((third.teamA / total) * 1000) / 10,
        teamB: Math.round((third.teamB / total) * 1000) / 10,
        contested: Math.round((third.contested / total) * 1000) / 10
      };
    };

    const zoneOfInfluence = {
      overall: {
        teamA: Math.round((overallTeamA / 3840) * 1000) / 10,
        teamB: Math.round((overallTeamB / 3840) * 1000) / 10,
        contested: Math.round((overallContested / 3840) * 1000) / 10
      },
      defensiveThird: thirdsPct(defThird),
      middleThird: thirdsPct(midThird),
      attackingThird: thirdsPct(attThird)
    };

    // 2. Exploitability in Opponent half only
    const exploitability = this.getExploitabilityResult();
    let exploitableCells = 0;
    let contestedCells = 0;
    let defendedCells = 0;
    let uselessCells = 0;
    let opponentHalfCellsCount = 0;

    for (let c = 0; c < cols; c++) {
      const cx = (c + 0.5) * cellW;
      const isOpponentHalf = (attackingTeam === "A") ? (cx >= 50.0) : (cx <= 50.0);
      if (!isOpponentHalf) continue;

      for (let r = 0; r < rows; r++) {
        opponentHalfCellsCount++;
        const stateVal = exploitability.cells[c][r].state;
        if (stateVal === ExploitabilityState.Defended) defendedCells++;
        else if (stateVal === ExploitabilityState.Exploitable) exploitableCells++;
        else if (stateVal === ExploitabilityState.Contested) contestedCells++;
        else if (stateVal === ExploitabilityState.Useless) uselessCells++;
      }
    }

    const opTotal = opponentHalfCellsCount || 1;
    const exploitabilityOpponentHalf = {
      exploitableCellsPct: Math.round((exploitableCells / opTotal) * 1000) / 10,
      contestedCellsPct: Math.round((contestedCells / opTotal) * 1000) / 10,
      defendedCellsPct: Math.round((defendedCells / opTotal) * 1000) / 10,
      uselessCellsPct: Math.round((uselessCells / opTotal) * 1000) / 10
    };

    // 3. Vulnerability in Opponent half only (active when B is attacking, i.e., attackingTeam === "B")
    let vulnerableRegionsCount = 0;
    let totalVulnerableCells = 0;

    if (attackingTeam === "B") {
      const cellStates: string[][] = [];
      for (let c = 0; c < cols; c++) {
        cellStates[c] = [];
        for (let r = 0; r < rows; r++) {
          const stateVal = exploitability.cells[c][r].state;
          cellStates[c][r] = stateVal === ExploitabilityState.Exploitable ? "Exploitable" : stateVal === ExploitabilityState.Contested ? "Contested" : stateVal === ExploitabilityState.Useless ? "Useless" : "Defended";
        }
      }

      const visited = Array.from({ length: cols }, () => new Uint8Array(rows));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (cellStates[c][r] === "Exploitable" && !visited[c][r]) {
            const component: [number, number][] = [];
            const queue: [number, number][] = [[c, r]];
            visited[c][r] = 1;

            while (queue.length > 0) {
              const curr = queue.shift()!;
              component.push(curr);
              const [cc, cr] = curr;

              for (let dc = -1; dc <= 1; dc++) {
                for (let dr = -1; dr <= 1; dr++) {
                  if (dc === 0 && dr === 0) continue;
                  const nc = cc + dc;
                  const nr = cr + dr;
                  if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
                    if (cellStates[nc][nr] === "Exploitable" && !visited[nc][nr]) {
                      visited[nc][nr] = 1;
                      queue.push([nc, nr]);
                    }
                  }
                }
              }
            }

            if (component.length < 6) {
              component.forEach(([cc, cr]) => {
                cellStates[cc][cr] = "Useless";
              });
            }
          }
        }
      }

      // Ray trace for Useless
      const bx = state.ball.x;
      const by = state.ball.y;
      const tracedStates = cellStates.map((col) => [...col]);

      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) * cellW;
        for (let r = 0; r < rows; r++) {
          if (cellStates[c][r] === "Useless") {
            const cellInfo = exploitability.cells[c][r];
            if (cellInfo.defenderArrival <= cellInfo.attackerArrival) {
              tracedStates[c][r] = "Defended";
              continue;
            }

            const cy = (r + 0.5) * cellH;
            const vx = cx - bx;
            const vy = cy - by;
            const dist = Math.hypot(vx, vy);
            if (dist < 0.05) continue;

            const dx = vx / dist;
            const dy = vy / dist;
            let inherited = "Useless";

            for (let s = 1; s <= 120; s++) {
              const tx = cx + s * 1.0 * dx;
              const ty = cy + s * 1.0 * dy;
              if (tx < 0 || tx > 100 || ty < 0 || ty > 60) break;

              const tc = Math.floor(tx / cellW);
              const tr = Math.floor(ty / cellH);
              if (tc >= 0 && tc < cols && tr >= 0 && tr < rows) {
                if (cellStates[tc][tr] !== "Useless") {
                  inherited = cellStates[tc][tr];
                  break;
                }
              }
            }
            tracedStates[c][r] = inherited;
          }
        }
      }

      // Group Exploitable in opponent half (x <= 50.0 since B is attacking)
      const vulnVisited = Array.from({ length: cols }, () => new Uint8Array(rows));
      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) * cellW;
        if (cx > 50.0) continue; // Opponent half only

        for (let r = 0; r < rows; r++) {
          if (tracedStates[c][r] === "Exploitable" && !vulnVisited[c][r]) {
            const component: [number, number][] = [];
            const queue: [number, number][] = [[c, r]];
            vulnVisited[c][r] = 1;

            while (queue.length > 0) {
              const curr = queue.shift()!;
              component.push(curr);
              const [cc, cr] = curr;

              for (let dc = -1; dc <= 1; dc++) {
                for (let dr = -1; dr <= 1; dr++) {
                  if (dc === 0 && dr === 0) continue;
                  const nc = cc + dc;
                  const nr = cr + dr;
                  if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
                    const ncx = (nc + 0.5) * cellW;
                    if (ncx <= 50.0 && tracedStates[nc][nr] === "Exploitable" && !vulnVisited[nc][nr]) {
                      vulnVisited[nc][nr] = 1;
                      queue.push([nc, nr]);
                    }
                  }
                }
              }
            }
            vulnerableRegionsCount++;
            totalVulnerableCells += component.length;
          }
        }
      }
    }

    const vulnerabilityDefendingHalf = {
      vulnerableRegionsCount,
      totalVulnerableCells
    };

    // 4. Passing Options (and Opponent Passing Options)
    const getPassingStats = (isAttacker: boolean) => {
      const matchesPossession = isAttacker ? (attackingTeam === "A") : (attackingTeam === "B");
      if (!matchesPossession) {
        return {
          totalOptionsCount: 0,
          progressiveOptionsCount: 0,
          averageSafeAreaOfProgressiveOptions: 0,
          bestProgressiveOption: null
        };
      }

      const passingResult = this.getPassingAnalysisResult();
      const bx = state.ball.x;
      const by = state.ball.y;

      const progressiveOptions = passingResult.options.filter((opt) => {
        const isProg = (attackingTeam === "A") ? (opt.representativePoint.x > bx) : (opt.representativePoint.x < bx);
        return isProg;
      });

      const safeProgressiveOptions = progressiveOptions.filter(o => o.hasSafe);
      const avgSafeCells = safeProgressiveOptions.length > 0
        ? safeProgressiveOptions.reduce((acc, curr) => acc + curr.safeCells.length, 0) / safeProgressiveOptions.length
        : 0;

      let bestProg: any = null;
      let minDistanceToGoal = Infinity;

      safeProgressiveOptions.forEach((opt) => {
        const distToGoal = (attackingTeam === "A") ? (100 - opt.representativePoint.x) : opt.representativePoint.x;
        if (distToGoal < minDistanceToGoal) {
          minDistanceToGoal = distToGoal;
          bestProg = opt;
        }
      });

      let bestProgressiveOption = null;
      if (bestProg) {
        const player = state.players.find((p: any) => p.id === bestProg.playerId);
        bestProgressiveOption = {
          jerseyNumber: player?.jerseyNumber || "Unknown",
          distanceToGoalLine: Math.round(minDistanceToGoal * 10) / 10,
          passDistance: Math.round(Math.hypot(bestProg.representativePoint.x - bx, bestProg.representativePoint.y - by) * 10) / 10,
          cellsCount: bestProg.safeCells.length,
          targetPoint: {
            x: Math.round(bestProg.representativePoint.x * 10) / 10,
            y: Math.round(bestProg.representativePoint.y * 10) / 10
          }
        };
      }

      return {
        totalOptionsCount: passingResult.options.length,
        progressiveOptionsCount: progressiveOptions.length,
        averageSafeCellsOfProgressiveOptions: Math.round(avgSafeCells * 10) / 10,
        bestProgressiveOption
      };
    };

    const passingOptions = getPassingStats(true);
    const opponentPassingOptions = getPassingStats(false);

    // 5. Running Channels / Opponent Runs
    const getRunStats = (isAttacker: boolean) => {
      const matchesPossession = isAttacker ? (attackingTeam === "A") : (attackingTeam === "B");
      if (!matchesPossession) {
        return { totalRunsCount: 0, runsInLeft: 0, runsInRight: 0, runsInCenter: 0 };
      }

      const runningResult = this.getRunningChannelsResult();
      let runsInLeft = 0;
      let runsInRight = 0;
      let runsInCenter = 0;

      runningResult.channels.forEach((ch) => {
        const y = ch.representativePoint.y;
        if (y < 20.0) runsInLeft++;
        else if (y > 40.0) runsInRight++;
        else runsInCenter++;
      });

      return {
        totalRunsCount: runningResult.channels.length,
        runsInLeft,
        runsInRight,
        runsInCenter
      };
    };

    const runningChannels = getRunStats(true);
    const opponentRuns = getRunStats(false);

    // 6. Overloads
    const getOverloadStats = (isAttackingOverload: boolean) => {
      const matchesPossession = isAttackingOverload ? (attackingTeam === "A") : (attackingTeam === "B");
      if (!matchesPossession) {
        return { totalOverloadsCount: 0, totalOverloadCells: 0, overloadsInLeft: 0, overloadsInRight: 0, overloadsInCenter: 0 };
      }

      const overloadResult = this.getOverloadAnalysisResult();
      let totalOverloadCells = 0;
      let overloadsInLeft = 0;
      let overloadsInRight = 0;
      let overloadsInCenter = 0;

      overloadResult.regions.forEach((reg) => {
        totalOverloadCells += reg.cells.length;
        const y = reg.representativePoint.y;
        if (y < 20.0) overloadsInLeft++;
        else if (y > 40.0) overloadsInRight++;
        else overloadsInCenter++;
      });

      return {
        totalOverloadsCount: overloadResult.regions.length,
        totalOverloadCells,
        overloadsInLeft,
        overloadsInRight,
        overloadsInCenter
      };
    };

    const attackingOverloads = getOverloadStats(true);
    const defensiveOverloads = getOverloadStats(false);

    return {
      frameIndex,
      possessionTeam: attackingTeam,
      teamAPhase,
      ball: { x: Math.round(state.ball.x * 10) / 10, y: Math.round(state.ball.y * 10) / 10 },
      zoneOfInfluence,
      exploitabilityOpponentHalf,
      vulnerabilityDefendingHalf,
      passingOptions,
      opponentPassingOptions,
      runningChannels,
      opponentRuns,
      attackingOverloads,
      defensiveOverloads
    };
  }
}

export const gameStateStore = new GameStateStore();
