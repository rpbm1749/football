from __future__ import annotations

from dataclasses import dataclass

from .models import BallState, PlayerState


@dataclass
class TouchEvent:
    player_id: int


class BallTouchDetector:
    def __init__(self, distance_threshold: float = 2.0, hysteresis_frames: int = 3, min_interval_seconds: float = 0.12):
        self.distance_threshold = distance_threshold
        self.hysteresis_frames = hysteresis_frames
        self.min_interval_seconds = min_interval_seconds
        self._candidate_player_id: int | None = None
        self._candidate_frames = 0
        self._last_touch_player_id: int | None = None
        self._last_touch_timestamp = -10_000.0

    def update(self, timestamp: float, players: list[PlayerState], ball: BallState | None) -> TouchEvent | None:
        if ball is None or not players:
            self._candidate_player_id = None
            self._candidate_frames = 0
            return None

        nearest = min(players, key=lambda player: _distance(player, ball))
        distance = _distance(nearest, ball)
        if distance > self.distance_threshold:
            self._candidate_player_id = None
            self._candidate_frames = 0
            return None

        if nearest.id == self._candidate_player_id:
            self._candidate_frames += 1
        else:
            self._candidate_player_id = nearest.id
            self._candidate_frames = 1

        interval_ok = timestamp - self._last_touch_timestamp >= self.min_interval_seconds
        player_changed = nearest.id != self._last_touch_player_id
        confirmed = self._candidate_frames >= self.hysteresis_frames
        if confirmed and interval_ok and (player_changed or self._ball_contact_changed(players, ball)):
            self._last_touch_player_id = nearest.id
            self._last_touch_timestamp = timestamp
            return TouchEvent(nearest.id)
        return None

    def _ball_contact_changed(self, players: list[PlayerState], ball: BallState) -> bool:
        ball_speed = (ball.velocity.vx**2 + ball.velocity.vy**2) ** 0.5
        return ball_speed > 0.2


def _distance(player: PlayerState, ball: BallState) -> float:
    return ((player.position.x - ball.position.x) ** 2 + (player.position.y - ball.position.y) ** 2) ** 0.5
