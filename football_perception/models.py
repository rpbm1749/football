from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any


PITCH_LENGTH = 100.0
PITCH_WIDTH = 60.0


class ObjectKind(str, Enum):
    PLAYER = "player"
    BALL = "ball"


class Team(str, Enum):
    LEFT = "left_team"
    RIGHT = "right_team"
    UNKNOWN = "unknown"
    REFEREE = "referee"


@dataclass(frozen=True)
class Point:
    x: float
    y: float


@dataclass(frozen=True)
class Velocity:
    vx: float = 0.0
    vy: float = 0.0


@dataclass(frozen=True)
class BoundingBox:
    x1: float
    y1: float
    x2: float
    y2: float

    @property
    def width(self) -> float:
        return max(0.0, self.x2 - self.x1)

    @property
    def height(self) -> float:
        return max(0.0, self.y2 - self.y1)

    @property
    def center(self) -> Point:
        return Point((self.x1 + self.x2) / 2.0, (self.y1 + self.y2) / 2.0)

    @property
    def foot_point(self) -> Point:
        return Point((self.x1 + self.x2) / 2.0, self.y2)


@dataclass(frozen=True)
class Detection:
    kind: ObjectKind
    bbox: BoundingBox
    confidence: float
    class_name: str = ""


@dataclass(frozen=True)
class TrackedDetection:
    track_id: int
    kind: ObjectKind
    bbox: BoundingBox
    confidence: float
    class_name: str = ""


@dataclass
class PlayerState:
    id: int
    team: Team
    is_goalkeeper: bool
    is_referee: bool
    position: Point
    velocity: Velocity
    movement_direction: Point | None = None
    heading_angle: float | None = None


@dataclass
class BallState:
    position: Point
    velocity: Velocity
    id: int | None = None


@dataclass
class FrameRef:
    video_path: str
    frame_number: int
    image_path: str | None = None


@dataclass
class GameState:
    timestamp: float
    frame_number: int
    frame_image: Any
    touching_player: int | None
    ball: BallState
    players: list[PlayerState]
    frame_ref: FrameRef | None = None


@dataclass
class ExtractionConfig:
    detector_model: str = "yolov8x.pt"
    detector_confidence: float = 0.05
    detector_imgsz: int | None = 1280
    tiled_inference: bool = True
    tile_grid: tuple[int, int] = (4, 3)
    tile_overlap: float = 0.25
    nms_iou_threshold: float = 0.45
    class_agnostic_players: bool = True
    player_min_bbox_area: float = 20.0
    player_max_bbox_area: float = 5000.0
    player_min_aspect_ratio: float = 0.2
    player_max_aspect_ratio: float = 5.0
    mog2_player_candidates: bool = True
    mog2_history: int = 120
    mog2_var_threshold: float = 16.0
    mog2_learning_rate: float = 0.01
    mog2_warmup_frames: int = 8
    mog2_max_foreground_ratio: float = 0.02
    mog2_min_area: float = 24.0
    mog2_max_area: float = 1800.0
    visual_player_candidates: bool = False
    visual_player_min_area: float = 12.0
    visual_player_max_area: float = 1800.0
    player_min_track_observations: int = 2
    player_promotion_confidence: float = 0.35
    ball_min_confidence: float = 0.06
    ball_min_bbox_area: float = 4.0
    ball_max_bbox_area: float = 900.0
    ball_max_player_iou: float = 0.05
    tracker: str = "bytetrack"
    pitch_length: float = PITCH_LENGTH
    pitch_width: float = PITCH_WIDTH
    touch_distance: float = 2.0
    touch_hysteresis_frames: int = 3
    min_touch_interval_seconds: float = 0.12
    record_all_frames: bool = True
    max_frames: int | None = None
    output_dir: str | Path = "outputs/perception"
    output_json_path: str | Path | None = None
    save_frame_images: bool = False
    frame_sample_stride: int = 1
    fail_without_detector: bool = True
    detector: Any = None
    tracker_component: Any = None
    pitch_mapper: Any = None
    team_assigner: Any = None
    touch_detector: Any = None
    metadata: dict[str, Any] = field(default_factory=dict)
