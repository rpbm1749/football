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
  }, [dimensions, state, editMode, selectedPlayerId]);

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
