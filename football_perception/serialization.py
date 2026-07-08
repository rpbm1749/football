from __future__ import annotations

import json
from dataclasses import asdict, is_dataclass
from enum import Enum
from pathlib import Path
from typing import Any

from .models import GameState


def save_game_states_json(game_states: list[GameState], output_path: str | Path) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    
    from .models import Team
    
    boards = []
    for state in game_states:
        # Map players to PlayerStateJSON
        players_json = []
        for player in state.players:
            # Map Team enum to "A" | "B" | "NONE"
            if player.team == Team.LEFT:
                team_str = "A"
            elif player.team == Team.RIGHT:
                team_str = "B"
            else:
                team_str = "NONE"
                
            players_json.append({
                "id": str(player.id),
                "team": team_str,
                "goalkeeper": bool(player.is_goalkeeper),
                "referee": bool(player.is_referee),
                "x": float(player.position.x),
                "y": float(player.position.y),
                "heading_angle": float(player.heading_angle or 0.0)
            })
            
        # Map ball to BallStateJSON
        ball_json = {
            "x": float(state.ball.position.x) if state.ball else 0.0,
            "y": float(state.ball.position.y) if state.ball else 0.0,
            "playerIdWhoHasPossession": str(state.touching_player) if state.touching_player is not None else None
        }
        
        boards.append({
            "name": f"Frame {state.frame_number} @ {state.timestamp:.2f}s",
            "ball": ball_json,
            "players": players_json
        })
        
    sequence_id = path.stem
    payload = {
        "type": "ScenarioSequence",
        "id": sequence_id,
        "name": sequence_id,
        "boards": boards
    }
    
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return path


def game_state_to_dict(game_state: GameState) -> dict[str, Any]:
    return {}
