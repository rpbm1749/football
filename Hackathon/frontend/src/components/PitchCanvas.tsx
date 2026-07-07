import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { gameStateStore } from "../simulation/rendering/GameStateStore";

export function PitchCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Subscribe to the central game state store
  const state = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getSnapshot.bind(gameStateStore)
  );

  const editMode = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getEditMode.bind(gameStateStore)
  );

  const selectedPlayerId = useSyncExternalStore(
    gameStateStore.subscribe.bind(gameStateStore),
    gameStateStore.getSelectedPlayerId.bind(gameStateStore)
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

  // Track dragging / rotating states locally
  const interactionRef = useRef<{
    isDragging: boolean;
    isRotating: boolean;
    dragTarget: "player" | "ball" | null;
    targetId: string | null;
  }>({
    isDragging: false,
    isRotating: false,
    dragTarget: null,
    targetId: null,
  });

  // Track parent container size changes using ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Calculate coordinates mapping helpers
  const pad = 25; // outer padding for goals and labels
  const pitchW = 100;
  const pitchH = 60;
  
  const scaleX = (dimensions.width - pad * 2) / pitchW;
  const scaleY = (dimensions.height - pad * 2) / pitchH;
  const scale = Math.min(scaleX, scaleY) || 1;

  const offsetX = pad + (dimensions.width - pad * 2 - pitchW * scale) / 2;
  const offsetY = pad + (dimensions.height - pad * 2 - pitchH * scale) / 2;

  // Logical space coordinates to canvas pixel space
  const toScreenX = (lx: number) => offsetX + lx * scale;
  const toScreenY = (ly: number) => offsetY + (60 - ly) * scale; // Y-flip: 0 is bottom, 60 is top
  const toScreenLength = (l: number) => l * scale;

  // Canvas pixel space coordinates to logical space
  const toLogicalX = (sx: number) => (sx - offsetX) / scale;
  const toLogicalY = (sy: number) => 60 - (sy - offsetY) / scale;

  // Main canvas render effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Scale canvas context for high-DPI screens to prevent blurriness
    const dpr = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * dpr;
    canvas.height = dimensions.height * dpr;
    canvas.style.width = `${dimensions.width}px`;
    canvas.style.height = `${dimensions.height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // Clear background
    ctx.fillStyle = "#0E1D14";
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // Draw base pitch background
    ctx.fillStyle = "#3B8A50";
    ctx.fillRect(
      toScreenX(0),
      toScreenY(60),
      toScreenLength(100),
      toScreenLength(60)
    );

    // 1. Draw Alternating Grass stripes (10 stripes total)
    const stripeW = 10; // 100 units / 10 stripes = 10 units each
    const darkGrass = "#347A45";
    const lightGrass = "#418C54";

    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? darkGrass : lightGrass;
      ctx.fillRect(
        toScreenX(i * stripeW),
        toScreenY(60),
        toScreenLength(stripeW),
        toScreenLength(60)
      );
    }

    // 1.5. Draw Zone of Influence Overlay (if active in View Mode)
    if (!editMode && showZoneOfInfluence) {
      const result = gameStateStore.getZoneInfluenceResult();
      const cols = result.cells.length;
      const rows = result.cells[0].length;
      const cellW = 100 / cols;
      const cellH = 60 / rows;

      for (let c = 0; c < cols; c++) {
        const xStart = toScreenX(c * cellW);
        const xWidth = toScreenX((c + 1) * cellW) - xStart;
        for (let r = 0; r < rows; r++) {
          const cell = result.cells[c][r];
          const yStart = toScreenY((r + 1) * cellH);
          const yHeight = toScreenY(r * cellH) - yStart;

          // Compute absolute difference in arrival times
          const arrivalA = cell.arrivalTimeA;
          const arrivalB = cell.arrivalTimeB;
          let diff = 0;
          if (arrivalA !== Infinity && arrivalB !== Infinity) {
            diff = Math.abs(arrivalA - arrivalB);
          } else if (arrivalA === Infinity && arrivalB === Infinity) {
            diff = 0;
          } else {
            diff = 3.0;
          }

          if (cell.isContested) {
            // Smoothly transition between Dark Purple (rgba(100, 10, 150, 0.42)) at diff = 0.0
            // and Light Purple (rgba(200, 120, 240, 0.42)) at diff = 0.25
            const t = Math.min(1.0, Math.max(0.0, diff / 0.25));
            const rComp = Math.round(100 + t * 100);
            const gComp = Math.round(10 + t * 110);
            const bComp = Math.round(150 + t * 90);
            ctx.fillStyle = `rgba(${rComp}, ${gComp}, ${bComp}, 0.42)`;
          } else {
            if (cell.controllingTeam === "A") {
              ctx.fillStyle = "rgba(65, 105, 225, 0.7)"; // Team A Blue
            } else if (cell.controllingTeam === "B") {
              ctx.fillStyle = "rgba(211, 211, 211, 0.6)"; // Team B White
            } else {
              continue;
            }
          }

          ctx.fillRect(xStart, yStart, xWidth, yHeight);
        }
      }
    }

    // 1.6. Draw Vulnerability Analysis Overlay (if active in View Mode and opponent has possession)
    const possessor = state.players.find(p => p.id === state.ball.playerIdWhoHasPossession);
    const isTeamBAttacking = possessor?.team === "B";
    if (!editMode && showVulnerability && isTeamBAttacking) {
      const result = gameStateStore.getExploitabilityResult();
      const cols = result.cells.length;
      const rows = result.cells[0].length;
      const cellW = 100 / cols;
      const cellH = 60 / rows;
      const bx = state.ball.x;
      const by = state.ball.y;

      // Copy states for processing
      const cellStates: string[][] = [];
      for (let c = 0; c < cols; c++) {
        cellStates[c] = [];
        for (let r = 0; r < rows; r++) {
          cellStates[c][r] = result.cells[c][r].state;
        }
      }

      // Step 1: Connected-Component Analysis (CCA) for noise reduction
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

              // Check 8-neighbors
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

            // If component is smaller than MIN_EXPLOITABLE_REGION_SIZE (6), filter it to Useless
            if (component.length < 6) {
              component.forEach(([cc, cr]) => {
                cellStates[cc][cr] = "Useless";
              });
            }
          }
        }
      }

      // Step 2: Ray-tracing forward along ball trajectory for Useless cells
      const tracedStates = cellStates.map((col) => [...col]);
      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) * cellW;
        for (let r = 0; r < rows; r++) {
          if (cellStates[c][r] === "Useless") {
            const cellInfo = result.cells[c][r];
            // If the defender can reach this cell before or at the same time as the attacker,
            // then the pass is intercepted/recovered by the defender first. It is Defended!
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
            // Trace forward along trajectory (away from the ball)
            for (let s = 1; s <= 120; s++) {
              const tx = cx + s * 1.0 * dx;
              const ty = cy + s * 1.0 * dy;

              if (tx < 0 || tx > 100 || ty < 0 || ty > 60) {
                break;
              }

              const tc = Math.floor(tx / cellW);
              const tr = Math.floor(ty / cellH);
              if (tc >= 0 && tc < cols && tr >= 0 && tr < rows) {
                const tState = cellStates[tc][tr];
                if (tState !== "Useless") {
                  inherited = tState;
                  break;
                }
              }
            }
            tracedStates[c][r] = inherited;
          }
        }
      }

      // Step 3: Pruning via spatial rules & Draw cells
      for (let c = 0; c < cols; c++) {
        const cx = (c + 0.5) * cellW;
        const xStart = toScreenX(c * cellW);
        const xWidth = toScreenX((c + 1) * cellW) - xStart;

        // Spatial Rules:
        // Rule 1: ball in B's half (bx >= 50.0) -> render only in A's half (cx < 50.0)
        // Rule 2: ball in A's half (33.33 <= bx < 50.0) -> render ahead of ball (cx < bx)
        // Rule 3: ball in A's final third (bx < 33.33) -> render final third (cx < 33.33)
        let passSpatial = false;
        if (bx >= 50.0) {
          if (cx < 50.0) passSpatial = true;
        } else if (bx >= 33.33 && bx < 50.0) {
          if (cx < bx) passSpatial = true;
        } else {
          if (cx < 33.33) passSpatial = true;
        }

        if (!passSpatial) continue;

        for (let r = 0; r < rows; r++) {
          const finalState = tracedStates[c][r];
          if (finalState === "Useless") continue;

          const yStart = toScreenY((r + 1) * cellH);
          const yHeight = toScreenY(r * cellH) - yStart;

          if (finalState === "Defended") {
            ctx.fillStyle = "rgba(46, 204, 113, 0.7)"; // Green
          } else if (finalState === "Contested") {
            ctx.fillStyle = "rgba(52, 152, 219, 0.7)"; // Blue
          } else if (finalState === "Exploitable") {
            ctx.fillStyle = "rgba(231, 76, 60, 0.7)"; // Strong Red
          } else {
            continue;
          }

          ctx.fillRect(xStart, yStart, xWidth, yHeight);
        }
      }
    }

    // 1.7. Draw Passing Analysis Overlay (if active in View Mode)
    const possessorForPass = state.players.find(p => p.id === state.ball.playerIdWhoHasPossession);
    const isTeamAAttackingForPass = possessorForPass?.team === "A";
    const isTeamBAttackingForPass = possessorForPass?.team === "B";
    const shouldRenderPassing = !editMode && (
      (showPassingOptions && isTeamAAttackingForPass) ||
      (showOpponentPassingOptions && isTeamBAttackingForPass)
    );

    if (shouldRenderPassing) {
      const passResult = gameStateStore.getPassingAnalysisResult();
      const cols = 80;
      const rows = 48;
      const cellW = 100 / cols;
      const cellH = 60 / rows;

      const ballScreenX = toScreenX(state.ball.x);
      const ballScreenY = toScreenY(state.ball.y);

      // Step A: Draw receiving region cell fills
      passResult.options.forEach((opt) => {
        const player = state.players.find(p => p.id === opt.playerId);

        // Safe cells
        opt.safeCells.forEach((c) => {
          const cellX = (c.col + 0.5) * cellW;
          const cellY = (c.row + 0.5) * cellH;
          const dist = player ? Math.hypot(cellX - player.x, cellY - player.y) : 0;
          let factor = 1.0;
          const fadeStart = 8.0;
          const fadeMax = 24.0;
          if (dist > fadeStart) {
            factor = Math.max(0.15, 1.0 - (dist - fadeStart) / (fadeMax - fadeStart));
          }

          ctx.fillStyle = isTeamAAttackingForPass 
            ? `rgba(46, 204, 113, ${0.7 * factor})` 
            : `rgba(231, 76, 60, ${0.7 * factor})`;

          const xStart = toScreenX(c.col * cellW);
          const xWidth = toScreenX((c.col + 1) * cellW) - xStart;
          const yStart = toScreenY((c.row + 1) * cellH);
          const yHeight = toScreenY(c.row * cellH) - yStart;
          ctx.fillRect(xStart, yStart, xWidth, yHeight);
        });

        // Risky cells
        opt.riskyCells.forEach((c) => {
          const cellX = (c.col + 0.5) * cellW;
          const cellY = (c.row + 0.5) * cellH;
          const dist = player ? Math.hypot(cellX - player.x, cellY - player.y) : 0;
          let factor = 1.0;
          const fadeStart = 8.0;
          const fadeMax = 24.0;
          if (dist > fadeStart) {
            factor = Math.max(0.15, 1.0 - (dist - fadeStart) / (fadeMax - fadeStart));
          }

          ctx.fillStyle = `rgba(241, 196, 15, ${0.7 * factor})`;

          const xStart = toScreenX(c.col * cellW);
          const xWidth = toScreenX((c.col + 1) * cellW) - xStart;
          const yStart = toScreenY((c.row + 1) * cellH);
          const yHeight = toScreenY(c.row * cellH) - yStart;
          ctx.fillRect(xStart, yStart, xWidth, yHeight);
        });
      });

      // Step B: Draw tactical passing arrows on top
      passResult.options.forEach((opt) => {
        const targetScreenX = toScreenX(opt.representativePoint.x);
        const targetScreenY = toScreenY(opt.representativePoint.y);
        const arrowColor = opt.hasSafe ? "#ffffff" : "#f1c40f";

        // Skip drawing if the target is right at the ball
        const distPx = Math.hypot(targetScreenX - ballScreenX, targetScreenY - ballScreenY);
        if (distPx < 10) return;

        if (opt.isAerial) {
          // 3D Lofted Aerial Pass (curved Bezier curve arching upwards)
          const midX = (ballScreenX + targetScreenX) / 2;
          const midY = (ballScreenY + targetScreenY) / 2;
          // Arch height scales with distance, capped at 90px
          const archHeight = Math.min(90, distPx * 0.25);
          const cpX = midX;
          const cpY = midY - archHeight; // offset Y towards top of screen

          // 1. Draw light ground trajectory shadow line
          ctx.save();
          ctx.strokeStyle = arrowColor;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.moveTo(ballScreenX, ballScreenY);
          ctx.lineTo(targetScreenX, targetScreenY);
          ctx.stroke();
          ctx.restore();

          // 2. Draw curved lofted pass curve with a drop shadow
          ctx.save();
          ctx.strokeStyle = arrowColor;
          ctx.lineWidth = 2.8;
          ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
          ctx.shadowBlur = 5;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 6;
          ctx.beginPath();
          ctx.moveTo(ballScreenX, ballScreenY);
          ctx.quadraticCurveTo(cpX, cpY, targetScreenX, targetScreenY);
          ctx.stroke();

          // Draw arrowhead pointing along curve tangent at end
          const tangentAngle = Math.atan2(targetScreenY - cpY, targetScreenX - cpX);
          ctx.fillStyle = arrowColor;
          ctx.beginPath();
          ctx.moveTo(targetScreenX, targetScreenY);
          ctx.lineTo(
            targetScreenX - 11 * Math.cos(tangentAngle - Math.PI / 6),
            targetScreenY - 11 * Math.sin(tangentAngle - Math.PI / 6)
          );
          ctx.lineTo(
            targetScreenX - 11 * Math.cos(tangentAngle + Math.PI / 6),
            targetScreenY - 11 * Math.sin(tangentAngle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          // Direct Ground Pass (straight solid arrow)
          ctx.save();
          ctx.strokeStyle = arrowColor;
          ctx.lineWidth = 2.8;
          ctx.fillStyle = arrowColor;
          ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
          ctx.shadowBlur = 3;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 2;

          ctx.beginPath();
          ctx.moveTo(ballScreenX, ballScreenY);
          ctx.lineTo(targetScreenX, targetScreenY);
          ctx.stroke();

          const angle = Math.atan2(targetScreenY - ballScreenY, targetScreenX - ballScreenX);
          ctx.beginPath();
          ctx.moveTo(targetScreenX, targetScreenY);
          ctx.lineTo(
            targetScreenX - 11 * Math.cos(angle - Math.PI / 6),
            targetScreenY - 11 * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            targetScreenX - 11 * Math.cos(angle + Math.PI / 6),
            targetScreenY - 11 * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      });
    }

    // 1.8. Draw Running Channels Overlay (if active in View Mode)
    const possessorForRuns = state.players.find(p => p.id === state.ball.playerIdWhoHasPossession);
    const isTeamAAttackingForRuns = possessorForRuns?.team === "A";
    const isTeamBAttackingForRuns = possessorForRuns?.team === "B";
    const shouldRenderRuns = !editMode && (
      (showAvailableRuns && isTeamAAttackingForRuns) ||
      (showOpponentRuns && isTeamBAttackingForRuns)
    );

    if (shouldRenderRuns) {
      const runResult = gameStateStore.getRunningChannelsResult();
      const cols = 80;
      const rows = 48;
      const cellW = 100 / cols;
      const cellH = 60 / rows;

      // Step A: Draw running channel cell fills (Green for Team A, Red for Team B)
      ctx.fillStyle = isTeamAAttackingForRuns ? "rgba(46, 204, 113, 0.7)" : "rgba(231, 76, 60, 0.7)";
      runResult.channels.forEach((chan) => {
        chan.cells.forEach((c) => {
          const xStart = toScreenX(c.col * cellW);
          const xWidth = toScreenX((c.col + 1) * cellW) - xStart;
          const yStart = toScreenY((c.row + 1) * cellH);
          const yHeight = toScreenY(c.row * cellH) - yStart;
          ctx.fillRect(xStart, yStart, xWidth, yHeight);
        });
      });

      // Step B: Draw dashed run arrows on top
      runResult.channels.forEach((chan) => {
        const player = state.players.find(p => p.id === chan.playerId);
        if (!player) return;

        const playerScreenX = toScreenX(player.x);
        const playerScreenY = toScreenY(player.y);
        const targetScreenX = toScreenX(chan.representativePoint.x);
        const targetScreenY = toScreenY(chan.representativePoint.y);

        const arrowColor = isTeamAAttackingForRuns ? "#ffffff" : "#ff4d4d"; // White vs Red

        // Skip drawing if target is too close to the player
        const distPx = Math.hypot(targetScreenX - playerScreenX, targetScreenY - playerScreenY);
        if (distPx < 10) return;

        ctx.save();
        ctx.strokeStyle = arrowColor;
        ctx.lineWidth = 2.8;
        ctx.fillStyle = arrowColor;
        ctx.setLineDash([6, 4]);
        ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 2;

        ctx.beginPath();
        ctx.moveTo(playerScreenX, playerScreenY);
        ctx.lineTo(targetScreenX, targetScreenY);
        ctx.stroke();

        ctx.setLineDash([]); // reset for arrowhead
        const angle = Math.atan2(targetScreenY - playerScreenY, targetScreenX - playerScreenX);
        ctx.beginPath();
        ctx.moveTo(targetScreenX, targetScreenY);
        ctx.lineTo(
          targetScreenX - 11 * Math.cos(angle - Math.PI / 6),
          targetScreenY - 11 * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          targetScreenX - 11 * Math.cos(angle + Math.PI / 6),
          targetScreenY - 11 * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
    }

    // 1.9. Draw Overload Analysis Overlay (if active in View Mode)
    const possessorForOverload = state.players.find(p => p.id === state.ball.playerIdWhoHasPossession);
    const isTeamAAttackingForOverload = possessorForOverload?.team === "A";
    const isTeamBAttackingForOverload = possessorForOverload?.team === "B";
    const shouldRenderOverloads = !editMode && (
      (showAttackingOverload && isTeamAAttackingForOverload) ||
      (showDefensiveOverload && isTeamBAttackingForOverload)
    );

    if (shouldRenderOverloads) {
      const overloadResult = gameStateStore.getOverloadAnalysisResult();
      const cols = 80;
      const rows = 48;
      const cellW = 100 / cols;
      const cellH = 60 / rows;

      // Step A: Draw overload region enclosing rounded rectangles (Translucent Purple)
      overloadResult.regions.forEach((reg) => {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;

        reg.cells.forEach((c) => {
          const cx = c.col * cellW;
          const cy = c.row * cellH;
          if (cx < minX) minX = cx;
          if (cx + cellW > maxX) maxX = cx + cellW;
          if (cy < minY) minY = cy;
          if (cy + cellH > maxY) maxY = cy + cellH;
        });

        // Convert coordinates to screen space
        const screenMinX = toScreenX(minX);
        const screenMaxX = toScreenX(maxX);
        const screenMinY = toScreenY(minY);
        const screenMaxY = toScreenY(maxY);

        // Calculate layout with a small padding
        let rectX = Math.min(screenMinX, screenMaxX);
        let rectY = Math.min(screenMinY, screenMaxY);
        let rectW = Math.abs(screenMaxX - screenMinX);
        let rectH = Math.abs(screenMaxY - screenMinY);

        // Add 6 pixels of padding
        rectX -= 6;
        rectY -= 6;
        rectW += 12;
        rectH += 12;

        ctx.save();
        ctx.fillStyle = "rgba(155, 89, 182, 0.22)";
        ctx.strokeStyle = "rgba(155, 89, 182, 0.75)";
        ctx.lineWidth = 2.2;
        ctx.shadowColor = "rgba(155, 89, 182, 0.3)";
        ctx.shadowBlur = 6;

        ctx.beginPath();
        ctx.roundRect(rectX, rectY, rectW, rectH, 10);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });

      // Step B: Draw dotted connection lines and player role badges
      overloadResult.regions.forEach((reg) => {
        const repX = toScreenX(reg.representativePoint.x);
        const repY = toScreenY(reg.representativePoint.y);

        // Helper to draw dotted line
        const drawDottedLine = (playerId: string) => {
          const player = state.players.find(p => p.id === playerId);
          if (!player) return;
          const px = toScreenX(player.x);
          const py = toScreenY(player.y);

          ctx.save();
          ctx.strokeStyle = "rgba(155, 89, 182, 0.85)";
          ctx.lineWidth = 1.8;
          ctx.setLineDash([4, 4]);
          ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
          ctx.shadowBlur = 2;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 1;

          ctx.beginPath();
          ctx.moveTo(repX, repY);
          ctx.lineTo(px, py);
          ctx.stroke();
          ctx.restore();
        };

        // Helper to draw badge above player
        const drawPlayerBadge = (playerId: string, label: string, badgeColor: string) => {
          const player = state.players.find(p => p.id === playerId);
          if (!player) return;
          const px = toScreenX(player.x);
          const py = toScreenY(player.y);

          ctx.save();
          ctx.fillStyle = badgeColor;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 1;
          ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
          ctx.shadowBlur = 3;
          ctx.shadowOffsetX = 1;
          ctx.shadowOffsetY = 2;

          const radius = 8;
          const bx = px;
          const by = py - toScreenLength(2.2); // Position badge slightly above player

          ctx.beginPath();
          ctx.arc(bx, by, radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowColor = "transparent"; // reset shadow for text
          ctx.fillText(label, bx, by);
          ctx.restore();
        };

        // Draw connections
        drawDottedLine(reg.primaryAttackerId);
        drawDottedLine(reg.supportingAttackerId);
        drawDottedLine(reg.primaryDefenderId);

        // Draw role badges (Green for A1/A2, Red for D1)
        drawPlayerBadge(reg.primaryAttackerId, "A1", "#2ecc71");
        drawPlayerBadge(reg.supportingAttackerId, "A2", "#2ecc71");
        drawPlayerBadge(reg.primaryDefenderId, "D1", "#e74c3c");
      });
    }

    // 2. Draw Pitch markings (Thin white crisp lines)
    ctx.strokeStyle = "#F5F5F5";
    ctx.lineWidth = Math.max(1.5, toScreenLength(0.22));
    ctx.fillStyle = "#F5F5F5";

    // Outer boundary
    ctx.strokeRect(
      toScreenX(0),
      toScreenY(60),
      toScreenLength(100),
      toScreenLength(60)
    );

    // Halfway line
    ctx.beginPath();
    ctx.moveTo(toScreenX(50), toScreenY(60));
    ctx.lineTo(toScreenX(50), toScreenY(0));
    ctx.stroke();

    // Center circle
    ctx.beginPath();
    ctx.arc(toScreenX(50), toScreenY(30), toScreenLength(9.15), 0, Math.PI * 2);
    ctx.stroke();

    // Center spot
    ctx.beginPath();
    ctx.arc(toScreenX(50), toScreenY(30), toScreenLength(0.48), 0, Math.PI * 2);
    ctx.fill();

    // Penalty areas
    // Left Box (extends 16.5 units, width 40.32 centered)
    ctx.strokeRect(
      toScreenX(0),
      toScreenY(30 + 20.16),
      toScreenLength(16.5),
      toScreenLength(40.32)
    );
    // Right Box
    ctx.strokeRect(
      toScreenX(83.5),
      toScreenY(30 + 20.16),
      toScreenLength(16.5),
      toScreenLength(40.32)
    );

    // Goal boxes (extends 5.5 units, width 18.32 centered)
    // Left Goalbox
    ctx.strokeRect(
      toScreenX(0),
      toScreenY(30 + 9.16),
      toScreenLength(5.5),
      toScreenLength(18.32)
    );
    // Right Goalbox
    ctx.strokeRect(
      toScreenX(94.5),
      toScreenY(30 + 9.16),
      toScreenLength(5.5),
      toScreenLength(18.32)
    );

    // Penalty spots (11 units from goal lines)
    ctx.beginPath();
    ctx.arc(toScreenX(11), toScreenY(30), toScreenLength(0.48), 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(toScreenX(89), toScreenY(30), toScreenLength(0.48), 0, Math.PI * 2);
    ctx.fill();

    // Penalty arcs
    const dx = 5.5; // distance from spot (11) to boundary (16.5)
    const arcRadius = 9.15;
    const halfAngle = Math.acos(dx / arcRadius);

    // Left Arc (bulges right, sweeps from -halfAngle to halfAngle)
    ctx.beginPath();
    ctx.arc(
      toScreenX(11),
      toScreenY(30),
      toScreenLength(arcRadius),
      -halfAngle,
      halfAngle,
      false
    );
    ctx.stroke();

    // Right Arc (bulges left, sweeps from PI-halfAngle to PI+halfAngle)
    ctx.beginPath();
    ctx.arc(
      toScreenX(89),
      toScreenY(30),
      toScreenLength(arcRadius),
      Math.PI - halfAngle,
      Math.PI + halfAngle,
      false
    );
    ctx.stroke();

    // Corner arcs (radius 1 unit)
    const cornerR = toScreenLength(1.0);
    // Top-Left (sweeps 0 to PI/2)
    ctx.beginPath();
    ctx.arc(toScreenX(0), toScreenY(60), cornerR, 0, Math.PI / 2);
    ctx.stroke();
    // Bottom-Left (sweeps 3*PI/2 to 2*PI)
    ctx.beginPath();
    ctx.arc(toScreenX(0), toScreenY(0), cornerR, Math.PI * 1.5, Math.PI * 2);
    ctx.stroke();
    // Top-Right (sweeps PI/2 to PI)
    ctx.beginPath();
    ctx.arc(toScreenX(100), toScreenY(60), cornerR, Math.PI / 2, Math.PI);
    ctx.stroke();
    // Bottom-Right (sweeps PI to 3*PI/2)
    ctx.beginPath();
    ctx.arc(toScreenX(100), toScreenY(0), cornerR, Math.PI, Math.PI * 1.5);
    ctx.stroke();

    // 3. Draw Goals (with transparent net fills and 3D supports)
    const goalTopY = 30 + 3.66;
    const goalDepth = 2.5;
    const goalWidth = 7.32;

    // Translucent goal nets
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fillRect(
      toScreenX(-goalDepth),
      toScreenY(goalTopY),
      toScreenLength(goalDepth),
      toScreenLength(goalWidth)
    );
    ctx.fillRect(
      toScreenX(100),
      toScreenY(goalTopY),
      toScreenLength(goalDepth),
      toScreenLength(goalWidth)
    );

    // Thick white goal posts outline
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = Math.max(2, toScreenLength(0.24));
    ctx.strokeRect(
      toScreenX(-goalDepth),
      toScreenY(goalTopY),
      toScreenLength(goalDepth),
      toScreenLength(goalWidth)
    );
    ctx.strokeRect(
      toScreenX(100),
      toScreenY(goalTopY),
      toScreenLength(goalDepth),
      toScreenLength(goalWidth)
    );

    // Net bracing lines
    ctx.strokeStyle = "rgba(220, 220, 220, 0.45)";
    ctx.lineWidth = toScreenLength(0.1);
    ctx.beginPath();
    // Left diagonal supports
    ctx.moveTo(toScreenX(-goalDepth), toScreenY(goalTopY));
    ctx.lineTo(toScreenX(0), toScreenY(goalTopY - goalWidth * 0.15));
    ctx.moveTo(toScreenX(-goalDepth), toScreenY(goalTopY - goalWidth));
    ctx.lineTo(toScreenX(0), toScreenY(goalTopY - goalWidth * 0.85));
    // Right diagonal supports
    ctx.moveTo(toScreenX(100 + goalDepth), toScreenY(goalTopY));
    ctx.lineTo(toScreenX(100), toScreenY(goalTopY - goalWidth * 0.15));
    ctx.moveTo(toScreenX(100 + goalDepth), toScreenY(goalTopY - goalWidth));
    ctx.lineTo(toScreenX(100), toScreenY(goalTopY - goalWidth * 0.85));
    ctx.stroke();

    // 4. Draw Players
    const playerRadius = 0.88; // logical units
    const screenR = toScreenLength(playerRadius);

    state.players.forEach((p) => {
      const isSelected = selectedPlayerId === p.id;
      const isRef = p.referee || p.id.startsWith("REF_");
      const isGK = p.goalkeeper;
      const px = toScreenX(p.x);
      const py = toScreenY(p.y);
      const angleRad = -(p.heading_angle * Math.PI) / 180; // CCW degrees to standard radians

      // A. Draw selected highlight glow
      if (isSelected && editMode) {
        ctx.strokeStyle = "rgba(0, 255, 136, 0.85)"; // neon green glow
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(px, py, screenR + 2.5, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = "rgba(0, 255, 136, 0.3)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, screenR + 5.5, 0, Math.PI * 2);
        ctx.stroke();

        // Draw dotted line to orientation rotation handle
        ctx.strokeStyle = "rgba(255, 215, 0, 0.6)";
        ctx.lineWidth = 1.0;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(px, py);
        const handleX = toScreenX(p.x + Math.cos(-angleRad) * 1.65);
        const handleY = toScreenY(p.y + Math.sin(-angleRad) * 1.65);
        ctx.lineTo(handleX, handleY);
        ctx.stroke();
        ctx.setLineDash([]); // clear dash style
      }

      // B. Drop shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.32)";
      ctx.beginPath();
      ctx.arc(px + 1.2, py + 1.2, screenR, 0, Math.PI * 2);
      ctx.fill();

      // C. Base Player Marker Body
      let fillColor = p.team === "A" ? "#1a73e8" : "#ffffff";
      let strokeColor = p.team === "A" ? "#0a3a99" : "#b0bec5";
      let accentColor = p.team === "A" ? "#ffffff" : "#1a73e8";

      if (isRef) {
        fillColor = "#1a1a1a";
        strokeColor = "#ffe600";
        accentColor = "#ffe600";
      } else if (isGK) {
        fillColor = p.team === "A" ? "#ff8c00" : "#00bfa5"; // bright orange vs teal
        strokeColor = "#ffffff";
        accentColor = "#ffffff";
      }

      ctx.fillStyle = fillColor;
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(px, py, screenR, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // D. Draw forward pointer nose triangle
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(angleRad); // rotate context to heading
      
      ctx.fillStyle = accentColor;
      ctx.strokeStyle = "#111111";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(screenR * 0.4, -screenR * 0.42);
      ctx.lineTo(screenR * 1.45, 0);
      ctx.lineTo(screenR * 0.4, screenR * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // E. Draw jersey number / role initials inside the player marker
      const displayChar = isRef ? "R" : (isGK ? "GK" : p.jerseyNumber || p.id.replace(/^\D+/, ""));
      if (displayChar) {
        ctx.fillStyle = isRef ? "#ffe600" : (p.team === "B" ? "#1a73e8" : "#ffffff");
        ctx.font = `bold ${Math.max(10, Math.round(scale * 0.76))}px 'Inter', 'Arial', sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(displayChar, px, py + 0.3); // offset Y slightly to center baseline
      }

      // F. Draw golden rotation handle if selected in Edit Mode
      if (isSelected && editMode) {
        const handleX = toScreenX(p.x + Math.cos(-angleRad) * 1.65);
        const handleY = toScreenY(p.y + Math.sin(-angleRad) * 1.65);

        ctx.fillStyle = "#ffd700";
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(handleX, handleY, toScreenLength(0.35), 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    });

    // 5. Draw Ball (Sleek soccer ball with pentagon details)
    const bx = toScreenX(state.ball.x);
    const by = toScreenY(state.ball.y);
    const ballR = toScreenLength(0.56);

    // Ball Drop shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.beginPath();
    ctx.arc(bx + 1.0, by + 1.0, ballR, 0, Math.PI * 2);
    ctx.fill();

    // Main ball circle
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(bx, by, ballR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pentagon details (classic soccer design)
    ctx.fillStyle = "#111111";
    ctx.beginPath();
    ctx.arc(bx, by, ballR * 0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 0.8;
    for (let angle = 0; angle < Math.PI * 2; angle += (Math.PI * 2) / 5) {
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + Math.cos(angle) * ballR, by + Math.sin(angle) * ballR);
      ctx.stroke();
    }

    ctx.restore();
  }, [dimensions, state, editMode, selectedPlayerId, showZoneOfInfluence, showVulnerability, showPassingOptions, showOpponentPassingOptions, showAvailableRuns, showOpponentRuns, showAttackingOverload, showDefensiveOverload]);

  // Pointer event handlers mapping screen space -> logical pitch space
  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const lx = toLogicalX(sx);
    const ly = toLogicalY(sy);

    // A. Check if rotation handle of selected player is clicked (Radius target: 0.8 logical units)
    if (selectedPlayerId && editMode) {
      const p = state.players.find((pl) => pl.id === selectedPlayerId);
      if (p) {
        const angleRad = -(p.heading_angle * Math.PI) / 180;
        const handleX = p.x + Math.cos(-angleRad) * 1.65;
        const handleY = p.y + Math.sin(-angleRad) * 1.65;

        const distHandle = Math.hypot(lx - handleX, ly - handleY);
        if (distHandle < 0.8) {
          interactionRef.current = {
            isDragging: false,
            isRotating: true,
            dragTarget: null,
            targetId: selectedPlayerId,
          };
          return;
        }
      }
    }

    // B. Check if any player is clicked (Generous target radius: 2.2 logical units)
    const clickedPlayer = state.players.find(
      (p) => Math.hypot(p.x - lx, p.y - ly) < 2.2
    );

    if (clickedPlayer) {
      gameStateStore.setSelectedPlayerId(clickedPlayer.id);
      if (editMode) {
        interactionRef.current = {
          isDragging: true,
          isRotating: false,
          dragTarget: "player",
          targetId: clickedPlayer.id,
        };
      }
      return;
    }

    // C. Check if ball is clicked (Generous target radius: 2.0 logical units)
    const distToBall = Math.hypot(state.ball.x - lx, state.ball.y - ly);
    if (distToBall < 2.0) {
      if (editMode) {
        interactionRef.current = {
          isDragging: true,
          isRotating: false,
          dragTarget: "ball",
          targetId: null,
        };
      }
      return;
    }

    // D. Clear selection if clicked empty area
    gameStateStore.setSelectedPlayerId(null);
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { isDragging, isRotating, dragTarget, targetId } = interactionRef.current;
    if (!isDragging && !isRotating) return;

    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const lx = toLogicalX(sx);
    const ly = toLogicalY(sy);
    const clampedX = Math.max(0, Math.min(100, lx));
    const clampedY = Math.max(0, Math.min(60, ly));

    if (isRotating && targetId) {
      const p = state.players.find((pl) => pl.id === targetId);
      if (p) {
        // Calculate angle CCW from player center to cursor in logical space
        const angleRad = Math.atan2(ly - p.y, lx - p.x);
        let degrees = (angleRad * 180) / Math.PI;
        // Convert to counter-clockwise degrees
        if (degrees < 0) degrees += 360;
        gameStateStore.updatePlayerHeading(targetId, degrees);
      }
    } else if (isDragging) {
      if (dragTarget === "player" && targetId) {
        gameStateStore.updatePlayerPosition(targetId, clampedX, clampedY);
      } else if (dragTarget === "ball") {
        gameStateStore.updateBallPosition(clampedX, clampedY);
      }
    }
  };

  const handlePointerUp = () => {
    interactionRef.current = {
      isDragging: false,
      isRotating: false,
      dragTarget: null,
      targetId: null,
    };
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        left: "274px",
        top: "70px",
        width: "calc(100vw - 548px)",
        height: "calc(100vh - 82px)",
        overflow: "hidden",
        borderRadius: "16px",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        background: "#0E1D14",
      }}
    >
      <canvas
        ref={canvasRef}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        style={{ display: "block", cursor: editMode ? "crosshair" : "default" }}
      />
    </div>
  );
}
