from __future__ import annotations

import math
import logging
from pathlib import Path

from .detectors import build_detector
from .models import (
    BallState,
    ExtractionConfig,
    FrameRef,
    GameState,
    ObjectKind,
    PlayerState,
    Point,
    Team,
    TrackedDetection,
    Velocity,
)
from .pitch import HomographyPitchMapper
from .serialization import save_game_states_json
from .teams import JerseyColorTeamAssigner
from .touch import BallTouchDetector
from .tracking import build_tracker

logger = logging.getLogger(__name__)

def extract_game_states(video_path: str | Path, config: ExtractionConfig | None = None) -> list[GameState]:
    config = config or ExtractionConfig()
    video_path = Path(video_path)
    output_dir = Path(config.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    logger.info(f"Starting extraction from video: {video_path}")
    logger.info(f"Config: detector_model={config.detector_model}, tracker={config.tracker}, max_frames={config.max_frames}")

    logger.info("Building components...")
    cv2 = _require_cv2()
    logger.info("  - Loading detector...")
    detector = build_detector(config)
    logger.info("  - Loading tracker...")
    tracker = config.tracker_component or build_tracker(config.tracker)
    logger.info("  - Creating pitch mapper...")
    pitch_mapper = config.pitch_mapper or HomographyPitchMapper(config.pitch_length, config.pitch_width)
    logger.info("  - Creating team assigner...")
    team_assigner = config.team_assigner or JerseyColorTeamAssigner()
    logger.info("  - Creating touch detector...")
    touch_detector = config.touch_detector or BallTouchDetector(
        config.touch_distance,
        config.touch_hysteresis_frames,
        config.min_touch_interval_seconds,
    )

    logger.info("Opening video file...")
    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise FileNotFoundError(f"Could not open video: {video_path}")
    logger.info("Video opened successfully.")

    fps = capture.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    logger.info(f"Video info: {total_frames} total frames @ {fps:.2f} FPS")
    
    states: list[GameState] = []
    previous_positions: dict[tuple[ObjectKind, int], tuple[Point, float]] = {}
    track_observations: dict[tuple[ObjectKind, int], int] = {}
    frame_number = -1
    fitted_pitch = False
    frames_processed = 0
    valid_states = 0

    logger.info("Starting frame processing...")
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        frame_number += 1
        if config.max_frames is not None and frame_number >= config.max_frames:
            logger.info(f"Reached max_frames limit ({config.max_frames})")
            break
        if frame_number % max(1, config.frame_sample_stride) != 0:
            continue
        
        frames_processed += 1
        timestamp = frame_number / fps
        
        if frames_processed % 50 == 0:
            logger.info(f"  Processing frame {frame_number}/{total_frames} ({100*frame_number/total_frames:.1f}%)")
        
        if not fitted_pitch:
            logger.info("  Fitting pitch mapper...")
            pitch_mapper.fit(frame)
            fitted_pitch = True
            if hasattr(detector, "set_pitch_bbox") and hasattr(pitch_mapper, "pitch_bbox"):
                detector.set_pitch_bbox(pitch_mapper.pitch_bbox())
            if hasattr(detector, "set_pitch_polygon") and hasattr(pitch_mapper, "pitch_polygon"):
                detector.set_pitch_polygon(pitch_mapper.pitch_polygon())
            logger.info("  Pitch mapper fitted.")

        detections = detector.detect(frame)
        detections = _filter_detections_to_pitch(detections, pitch_mapper)
        logger.debug(f"Frame {frame_number}: Detected {len(detections)} objects")
        
        tracked = tracker.update(detections)
        tracked_players = _promote_player_tracks(
            [item for item in tracked if item.kind == ObjectKind.PLAYER],
            track_observations,
            config,
        )
        tracked_balls = [item for item in tracked if item.kind == ObjectKind.BALL]
        logger.debug(f"Frame {frame_number}: Tracked {len(tracked_players)} players, {len(tracked_balls)} balls")

        team_assigner.observe(frame, tracked_players)
        players = _build_players(tracked_players, pitch_mapper, previous_positions, timestamp)
        players = team_assigner.assign(players)
        
        # Count goalkeepers and other players
        goalkeepers = [p for p in players if p.is_goalkeeper]
        non_goalkeeper_players = [p for p in players if not p.is_goalkeeper]
        logger.debug(f"Frame {frame_number}: Built {len(non_goalkeeper_players)} regular players, {len(goalkeepers)} goalkeepers")
        
        ball = _build_ball(tracked_balls, tracked_players, pitch_mapper, previous_positions, timestamp, config)
        ball_status = "DETECTED" if ball is not None else "NOT DETECTED"
        logger.debug(f"Frame {frame_number}: Ball {ball_status}")
        
        event = touch_detector.update(timestamp, players, ball)
        
        if event is None:
            logger.debug(f"Frame {frame_number}: Skipped - no touch event detected")
            continue
        if ball is None:
            logger.debug(f"Frame {frame_number}: Skipped - ball is None")
            continue
        
        valid_states += 1
        frame_ref = _build_frame_ref(cv2, video_path, frame, frame_number, output_dir, config.save_frame_images)
        states.append(
            GameState(
                timestamp=timestamp,
                frame_number=frame_number,
                frame_image=frame.copy(),
                touching_player=event.player_id,
                ball=ball,
                players=players,
                frame_ref=frame_ref,
            )
        )

    capture.release()
    logger.info(f"Frame processing complete. Processed {frames_processed} frames, found {valid_states} valid game states.")
    
    output_json = Path(config.output_json_path) if config.output_json_path else output_dir / f"{video_path.stem}.game_states.json"
    logger.info(f"Saving {len(states)} game states to {output_json}")
    save_game_states_json(states, output_json)
    logger.info("Extraction complete!")
    return states


def _build_players(
    tracked_players: list[TrackedDetection],
    pitch_mapper,
    previous_positions: dict[tuple[ObjectKind, int], tuple[Point, float]],
    timestamp: float,
) -> list[PlayerState]:
    players: list[PlayerState] = []
    for tracked in tracked_players:
        position = pitch_mapper.image_to_pitch(tracked.bbox.foot_point)
        velocity = _velocity(ObjectKind.PLAYER, tracked.track_id, position, timestamp, previous_positions)
        movement_direction = _movement_direction(velocity)
        players.append(
            PlayerState(
                id=tracked.track_id,
                team=Team.UNKNOWN,
                is_goalkeeper=False,
                is_referee=False,
                position=position,
                velocity=velocity,
                movement_direction=movement_direction,
                heading_angle=_heading_angle(movement_direction),
            )
        )
    return players


def _build_ball(
    tracked_balls: list[TrackedDetection],
    tracked_players: list[TrackedDetection],
    pitch_mapper,
    previous_positions: dict[tuple[ObjectKind, int], tuple[Point, float]],
    timestamp: float,
    config: ExtractionConfig,
) -> BallState | None:
    tracked = _select_ball_track(tracked_balls, tracked_players, config)
    if tracked is None:
        return None
    position = pitch_mapper.image_to_pitch(tracked.bbox.center)
    velocity = _velocity(ObjectKind.BALL, tracked.track_id, position, timestamp, previous_positions)
    return BallState(position=position, velocity=velocity, id=tracked.track_id)


def _promote_player_tracks(
    tracked_players: list[TrackedDetection],
    track_observations: dict[tuple[ObjectKind, int], int],
    config: ExtractionConfig,
) -> list[TrackedDetection]:
    promoted: list[TrackedDetection] = []
    for tracked in tracked_players:
        key = (ObjectKind.PLAYER, tracked.track_id)
        track_observations[key] = track_observations.get(key, 0) + 1
        observed_enough = track_observations[key] >= max(1, config.player_min_track_observations)
        high_confidence = tracked.class_name != "visual" and tracked.confidence >= config.player_promotion_confidence
        if observed_enough or high_confidence:
            promoted.append(tracked)
    return promoted


def _select_ball_track(
    tracked_balls: list[TrackedDetection],
    tracked_players: list[TrackedDetection],
    config: ExtractionConfig,
) -> TrackedDetection | None:
    plausible = [
        ball
        for ball in tracked_balls
        if _is_plausible_ball(ball, tracked_players, config)
    ]
    if not plausible:
        return None
    return max(plausible, key=lambda item: item.confidence)


def _is_plausible_ball(
    tracked_ball: TrackedDetection,
    tracked_players: list[TrackedDetection],
    config: ExtractionConfig,
) -> bool:
    if tracked_ball.confidence < config.ball_min_confidence:
        return False
    area = tracked_ball.bbox.width * tracked_ball.bbox.height
    if area < config.ball_min_bbox_area or area > config.ball_max_bbox_area:
        return False
    aspect_ratio = tracked_ball.bbox.width / max(tracked_ball.bbox.height, 1e-6)
    if aspect_ratio < 0.35 or aspect_ratio > 2.8:
        return False
    for player in tracked_players:
        if _bbox_iou(tracked_ball.bbox, player.bbox) > config.ball_max_player_iou:
            return False
        if _point_in_bbox(tracked_ball.bbox.center, player.bbox):
            return False
    return True


def _bbox_iou(a, b) -> float:
    x1 = max(a.x1, b.x1)
    y1 = max(a.y1, b.y1)
    x2 = min(a.x2, b.x2)
    y2 = min(a.y2, b.y2)
    intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    union = a.width * a.height + b.width * b.height - intersection
    return 0.0 if union <= 0.0 else intersection / union


def _point_in_bbox(point: Point, bbox) -> bool:
    return bbox.x1 <= point.x <= bbox.x2 and bbox.y1 <= point.y <= bbox.y2


def _velocity(
    kind: ObjectKind,
    track_id: int,
    position: Point,
    timestamp: float,
    previous_positions: dict[tuple[ObjectKind, int], tuple[Point, float]],
) -> Velocity:
    key = (kind, track_id)
    previous = previous_positions.get(key)
    previous_positions[key] = (position, timestamp)
    if previous is None:
        return Velocity()
    previous_position, previous_timestamp = previous
    dt = max(1e-6, timestamp - previous_timestamp)
    return Velocity((position.x - previous_position.x) / dt, (position.y - previous_position.y) / dt)


def _movement_direction(velocity: Velocity) -> Point | None:
    magnitude = (velocity.vx**2 + velocity.vy**2) ** 0.5
    if magnitude < 1e-6:
        return None
    return Point(velocity.vx / magnitude, velocity.vy / magnitude)


def _heading_angle(direction: Point | None) -> float | None:
    if direction is None:
        return None
    return math.degrees(math.atan2(direction.y, direction.x))


def _filter_detections_to_pitch(detections, pitch_mapper):
    if not hasattr(pitch_mapper, "contains_image_point"):
        return detections
    return [detection for detection in detections if pitch_mapper.contains_image_point(detection.bbox.center)]


def _build_frame_ref(cv2, video_path: Path, frame, frame_number: int, output_dir: Path, save_image: bool) -> FrameRef:
    image_path = None
    if save_image:
        frames_dir = output_dir / f"{video_path.stem}_frames"
        frames_dir.mkdir(parents=True, exist_ok=True)
        image_path = frames_dir / f"frame_{frame_number:06d}.jpg"
        cv2.imwrite(str(image_path), frame)
    return FrameRef(str(video_path), frame_number, str(image_path) if image_path else None)


def _require_cv2():
    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError(
            "OpenCV is required to read videos. Install dependencies from requirements-perception.txt."
        ) from exc
    return cv2
