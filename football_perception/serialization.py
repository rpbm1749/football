from __future__ import annotations

import json
from dataclasses import asdict, is_dataclass
from enum import Enum
from pathlib import Path
from typing import Any

from .models import GameState


def _json_default(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, Path):
        return str(value)
    if is_dataclass(value):
        data = asdict(value)
        data.pop("frame_image", None)
        return data
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def game_state_to_dict(game_state: GameState) -> dict[str, Any]:
    data = asdict(game_state)
    data.pop("frame_image", None)
    return _enum_to_value(data)


def _enum_to_value(value: Any) -> Any:
    if isinstance(value, Enum):
        return value.value
    if isinstance(value, list):
        return [_enum_to_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _enum_to_value(item) for key, item in value.items()}
    return value


def save_game_states_json(game_states: list[GameState], output_path: str | Path) -> Path:
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = [game_state_to_dict(state) for state in game_states]
    path.write_text(json.dumps(payload, indent=2, default=_json_default), encoding="utf-8")
    return path
