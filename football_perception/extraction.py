from __future__ import annotations

import math
import logging
from pathlib import Path

from .detectors import build_detector
from .models import (
    BallState,
    Detection,
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
    last_known_ball = None
    last_known_ball_pos = None
    ball_miss_count = 0
    possessing_player_id = None
    
    # Pre-pass to find static ball spots (e.g. penalty spots, pitch markings)
    logger.info("Running pre-pass on first 50 frames to identify static ball markings...")
    static_ball_spots = []
    ball_detections_history = []
    
    pre_cap = cv2.VideoCapture(str(video_path))
    if pre_cap.isOpened():
        for _ in range(50):
            ok, f_frame = pre_cap.read()
            if not ok:
                break
            if not fitted_pitch:
                pitch_mapper.fit(f_frame)
                fitted_pitch = True
                if hasattr(detector, "set_pitch_bbox") and hasattr(pitch_mapper, "pitch_bbox"):
                    detector.set_pitch_bbox(pitch_mapper.pitch_bbox())
                if hasattr(detector, "set_pitch_polygon") and hasattr(pitch_mapper, "pitch_polygon"):
                    detector.set_pitch_polygon(pitch_mapper.pitch_polygon())
            
            f_dets = detector.detect(f_frame)
            f_dets = _filter_detections_to_pitch(f_dets, pitch_mapper)
            for d in f_dets:
                if d.kind == ObjectKind.BALL:
                    ball_pos = pitch_mapper.image_to_pitch(d.bbox.center)
                    ball_detections_history.append(ball_pos)
        pre_cap.release()
        
    for p in ball_detections_history:
        neighbors = [n for n in ball_detections_history if ((n.x - p.x)**2 + (n.y - p.y)**2)**0.5 < 0.5]
        if len(neighbors) >= 15:
            if not any(((s.x - p.x)**2 + (s.y - p.y)**2)**0.5 < 0.5 for s in static_ball_spots):
                static_ball_spots.append(p)
                logger.info(f"Identified static ball spot (penalty spot/marking) at: ({p.x:.2f}, {p.y:.2f})")

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
        
        # Ball gating: filter out physically impossible ball detections and static markings
        valid_tracked_balls = []
        for b_det in tracked_balls:
            ball_pos = pitch_mapper.image_to_pitch(b_det.bbox.center)
            
            # Filter out static spots (penalty spots/logos)
            if any(((ball_pos.x - s.x)**2 + (ball_pos.y - s.y)**2)**0.5 < 1.2 for s in static_ball_spots):
                logger.debug(f"Frame {frame_number}: Rejected ball candidate at ({ball_pos.x:.1f}, {ball_pos.y:.1f}) - too close to static marking")
                continue
                
            if last_known_ball_pos is not None:
                dist = ((ball_pos.x - last_known_ball_pos.x)**2 + (ball_pos.y - last_known_ball_pos.y)**2)**0.5
                max_allowed_dist = 3.0 * (ball_miss_count + 1)
                if dist > max_allowed_dist:
                    logger.debug(f"Frame {frame_number}: Rejected ball candidate at ({ball_pos.x:.1f}, {ball_pos.y:.1f}) - distance {dist:.1f}m > {max_allowed_dist:.1f}m")
                    continue
            valid_tracked_balls.append(b_det)
            
        logger.debug(f"Frame {frame_number}: Tracked {len(tracked_players)} players, {len(valid_tracked_balls)} balls after gating (raw {len(tracked_balls)})")

        team_assigner.observe(frame, tracked_players)
        players = _build_players(tracked_players, pitch_mapper, previous_positions, timestamp)
        players = team_assigner.assign(players)
        
        # Count goalkeepers and other players
        goalkeepers = [p for p in players if p.is_goalkeeper]
        non_goalkeeper_players = [p for p in players if not p.is_goalkeeper]
        logger.debug(f"Frame {frame_number}: Built {len(non_goalkeeper_players)} regular players, {len(goalkeepers)} goalkeepers")
        
        # Build ball from the valid filtered detections
        ball = _build_ball(valid_tracked_balls, tracked_players, pitch_mapper, previous_positions, timestamp, config)
        
        if ball is not None:
            last_known_ball_pos = ball.position
            ball_miss_count = 0
        else:
            ball_miss_count += 1
            # If ball is occluded/lost, try to lock to the player in possession
            if possessing_player_id is not None:
                poss_player = next((p for p in players if p.id == possessing_player_id), None)
                if poss_player is not None:
                    # Attach ball to the player holding possession
                    ball = BallState(position=poss_player.position, velocity=Velocity(), id=-1)
                    last_known_ball_pos = ball.position
                    logger.debug(f"Frame {frame_number}: Ball occluded - attached to possessing Player {possessing_player_id}")
            
            # Static fallback if possession lock is unavailable
            if ball is None:
                if last_known_ball_pos is not None:
                    ball = BallState(position=last_known_ball_pos, velocity=Velocity(), id=-1)
                else:
                    ball = BallState(position=Point(50.0, 30.0), velocity=Velocity(), id=-1)
                logger.debug(f"Frame {frame_number}: Ball occluded - static fallback to ({ball.position.x:.1f}, {ball.position.y:.1f})")
                
        ball_status = "DETECTED" if ball is not None and ball.id != -1 else "OCCLUDED/PROPAGATED"
        logger.debug(f"Frame {frame_number}: Ball {ball_status}")
        
        # Update possession
        if ball is not None and players:
            # Find the nearest player to the ball
            nearest_player = None
            min_dist = float('inf')
            for p in players:
                # Exclude referee from possession
                if p.is_referee:
                    continue
                dist = ((p.position.x - ball.position.x)**2 + (p.position.y - ball.position.y)**2)**0.5
                if dist < min_dist:
                    min_dist = dist
                    nearest_player = p
            
            if nearest_player is not None:
                if min_dist < 2.0:
                    possessing_player_id = nearest_player.id
                elif possessing_player_id is not None and min_dist > 3.5:
                    possessing_player_id = None
        
        event = touch_detector.update(timestamp, players, ball)
        
        if not config.record_all_frames:
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
                touching_player=event.player_id if event is not None else None,
                ball=ball,
                players=players,
                frame_ref=frame_ref,
            )
        )

    capture.release()
    logger.info(f"Frame processing complete. Processed {frames_processed} frames, found {valid_states} valid game states.")
    
    # Linearly interpolate player track gaps to prevent player dropouts
    _interpolate_player_tracks(states, max_gap_frames=60)
    
    # Retroactively assign teams/roles using the complete tracking history
    for state in states:
        for player in state.players:
            counts = team_assigner._class_counts.get(player.id)
            if counts:
                dominant_class = counts.most_common(1)[0][0]
                player.is_goalkeeper = (dominant_class == "goalkeeper")
                player.is_referee = (dominant_class == "referee")
            if player.is_referee:
                player.team = Team.REFEREE
            elif player.is_goalkeeper:
                player.team = Team.LEFT if player.position.x < (PITCH_LENGTH / 2) else Team.RIGHT
            else:
                player.team = team_assigner._team_by_track.get(player.id, Team.UNKNOWN)
    
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
    tracked = _select_ball_track(tracked_balls, tracked_players, config, pitch_mapper)
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
    pitch_mapper,
) -> TrackedDetection | None:
    plausible = [
        ball
        for ball in tracked_balls
        if _is_plausible_ball(ball, tracked_players, config)
    ]
    if not plausible:
        return None
    if not tracked_players:
        return max(plausible, key=lambda item: item.confidence)
        
    scored_balls = []
    for ball in plausible:
        ball_pos = pitch_mapper.image_to_pitch(ball.bbox.center)
        min_dist = float('inf')
        for player in tracked_players:
            player_pos = pitch_mapper.image_to_pitch(player.bbox.foot_point)
            dist = ((player_pos.x - ball_pos.x)**2 + (player_pos.y - ball_pos.y)**2)**0.5
            if dist < min_dist:
                min_dist = dist
        
        # Penalize ball tracks that are far away from players to filter out static false positives
        proximity_factor = 1.0 / (1.0 + min_dist / 3.0)
        score = ball.confidence * proximity_factor
        scored_balls.append((score, ball))
        
    return max(scored_balls, key=lambda item: item[0])[1]


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


def _interpolate_player_tracks(states: list[GameState], max_gap_frames: int = 60) -> None:
    from collections import defaultdict
    import copy
    player_obs = defaultdict(list)
    for idx, state in enumerate(states):
        for player in state.players:
            player_obs[player.id].append((idx, player))
            
    for pid in player_obs:
        player_obs[pid].sort(key=lambda x: x[0])
        
    # Identify static false-positive tracks (e.g. penalty spots, pitch markings)
    static_tracks = set()
    for pid, obs in player_obs.items():
        if len(obs) >= 30:
            xs = [o[1].position.x for o in obs]
            ys = [o[1].position.y for o in obs]
            max_disp = ((max(xs) - min(xs))**2 + (max(ys) - min(ys))**2)**0.5
            if max_disp < 0.15:
                static_tracks.add(pid)
                
    if static_tracks:
        logger.info(f"Filtering out static false-positive tracks (penalty spots/pitch markings): {static_tracks}")
        for state in states:
            state.players = [p for p in state.players if p.id not in static_tracks]
        for pid in static_tracks:
            player_obs.pop(pid, None)
            
    # Select the top 22 player tracks with the most detections
    top_22_ids = sorted(player_obs.keys(), key=lambda pid: len(player_obs[pid]), reverse=True)[:22]
    top_22_set = set(top_22_ids)
    
    # Filter states to only contain these top 22 players
    for state in states:
        state.players = [p for p in state.players if p.id in top_22_set]
        
    # Propagate the top 22 players to cover ALL frames
    num_frames = len(states)
    for pid in top_22_ids:
        obs = player_obs[pid]
        obs_indices = [o[0] for o in obs]
        first_idx = obs_indices[0]
        last_idx = obs_indices[-1]
        
        # 1. Fill backward from first_idx to 0
        p_first = obs[0][1]
        for idx in range(0, first_idx):
            from .models import Velocity
            p_copy = copy.copy(p_first)
            p_copy.velocity = Velocity(0.0, 0.0)
            states[idx].players.append(p_copy)
            
        # 2. Fill forward from last_idx to num_frames - 1
        p_last = obs[-1][1]
        for idx in range(last_idx + 1, num_frames):
            from .models import Velocity
            p_copy = copy.copy(p_last)
            p_copy.velocity = Velocity(0.0, 0.0)
            states[idx].players.append(p_copy)
            
        # 3. Fill intermediate gaps using linear interpolation
        for i in range(len(obs) - 1):
            idx1, p1 = obs[i]
            idx2, p2 = obs[i+1]
            gap = idx2 - idx1
            if gap > 1:
                for step in range(1, gap):
                    idx = idx1 + step
                    t = step / gap
                    
                    interp_x = p1.position.x + t * (p2.position.x - p1.position.x)
                    interp_y = p1.position.y + t * (p2.position.y - p1.position.y)
                    
                    dt = states[idx].timestamp - states[idx-1].timestamp
                    if dt <= 0:
                        dt = 0.04
                    vel_x = (p2.position.x - p1.position.x) / ((idx2 - idx1) * dt)
                    vel_y = (p2.position.y - p1.position.y) / ((idx2 - idx1) * dt)
                    
                    from .models import PlayerState, Point, Velocity, Team
                    interp_player = PlayerState(
                        id=pid,
                        team=Team.UNKNOWN,
                        is_goalkeeper=False,
                        is_referee=False,
                        position=Point(interp_x, interp_y),
                        velocity=Velocity(vel_x, vel_y),
                        movement_direction=_movement_direction(Velocity(vel_x, vel_y)),
                        heading_angle=p1.heading_angle,
                    )
                    interp_player.heading_angle = _heading_angle(interp_player.movement_direction)
                    states[idx].players.append(interp_player)
