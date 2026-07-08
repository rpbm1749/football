from __future__ import annotations

from collections import Counter, defaultdict

import numpy as np

from .models import PITCH_LENGTH, PlayerState, Team, TrackedDetection


class JerseyColorTeamAssigner:
    def __init__(self, min_color_samples: int = 3):
        self.min_color_samples = min_color_samples
        self._color_samples: dict[int, list[np.ndarray]] = defaultdict(list)
        self._team_by_track: dict[int, Team] = {}
        self._special_by_track: dict[int, tuple[bool, bool]] = {}
        self._class_counts: dict[int, Counter] = defaultdict(Counter)

    def observe(self, frame, tracked_players: list[TrackedDetection]) -> None:
        for player in tracked_players:
            if player.class_name:
                self._class_counts[player.track_id][player.class_name] += 1

            sample = _sample_jersey_color(frame, player)
            if sample is not None:
                # Exclude goalkeepers and referees from color samples to keep outfield clustering clean
                counts = self._class_counts.get(player.track_id)
                dominant_class = counts.most_common(1)[0][0] if counts else None
                if dominant_class not in {"goalkeeper", "referee"}:
                    self._color_samples[player.track_id].append(sample)
                    self._color_samples[player.track_id] = self._color_samples[player.track_id][-30:]

    def assign(self, players: list[PlayerState]) -> list[PlayerState]:
        if not players:
            return players

        self._refresh_assignments(players)
        for player in players:
            # Determine dominant class to assign goalkeeper and referee flags
            counts = self._class_counts.get(player.id)
            if counts:
                dominant_class = counts.most_common(1)[0][0]
                player.is_goalkeeper = (dominant_class == "goalkeeper")
                player.is_referee = (dominant_class == "referee")
            else:
                player.is_goalkeeper = False
                player.is_referee = False

            if player.is_referee:
                player.team = Team.REFEREE
            elif player.is_goalkeeper:
                # Goalkeeper belongs to the team defending the half of the pitch they are positioned in
                player.team = Team.LEFT if player.position.x < PITCH_LENGTH / 2 else Team.RIGHT
            else:
                player.team = self._team_by_track.get(player.id, Team.UNKNOWN)
        return players


    def _refresh_assignments(self, players: list[PlayerState]) -> None:
        color_by_id = {
            track_id: np.mean(samples[-12:], axis=0)
            for track_id, samples in self._color_samples.items()
            if len(samples) >= self.min_color_samples
        }
        active_ids = [player.id for player in players if player.id in color_by_id]
        if len(active_ids) < 2:
            return

        labels = _cluster_two_colors(np.array([color_by_id[player_id] for player_id in active_ids]))
        cluster_counts = Counter(labels)
        dominant_clusters = {label for label, _ in cluster_counts.most_common(2)}
        cluster_to_team = self._orient_clusters(players, active_ids, labels)

        for player in players:
            if player.id not in active_ids:
                continue
            label = labels[active_ids.index(player.id)]
            if label in dominant_clusters and self._team_by_track.get(player.id, Team.UNKNOWN) == Team.UNKNOWN:
                self._team_by_track[player.id] = cluster_to_team.get(label, Team.UNKNOWN)

    def _assign_by_pitch_side(self, players: list[PlayerState]) -> None:
        for player in players:
            self._team_by_track[player.id] = Team.LEFT if player.position.x < PITCH_LENGTH / 2 else Team.RIGHT

    def _orient_clusters(self, players: list[PlayerState], active_ids: list[int], labels: list[int]) -> dict[int, Team]:
        positions_by_label: dict[int, list[float]] = defaultdict(list)
        position_by_id = {player.id: player.position.x for player in players}
        for player_id, label in zip(active_ids, labels):
            positions_by_label[label].append(position_by_id[player_id])
        ordered = sorted(positions_by_label, key=lambda label: np.mean(positions_by_label[label]))
        if len(ordered) < 2:
            return {ordered[0]: Team.UNKNOWN}
        return {ordered[0]: Team.LEFT, ordered[1]: Team.RIGHT}


def _sample_jersey_color(frame, player: TrackedDetection) -> np.ndarray | None:
    if frame is None:
        return None
    height, width = frame.shape[:2]
    x1 = int(max(0, min(width - 1, player.bbox.x1)))
    x2 = int(max(0, min(width, player.bbox.x2)))
    y1 = int(max(0, min(height - 1, player.bbox.y1 + player.bbox.height * 0.15)))
    y2 = int(max(0, min(height, player.bbox.y1 + player.bbox.height * 0.75)))
    if x2 <= x1 or y2 <= y1:
        return None
    crop = frame[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    try:
        import cv2

        hsv = cv2.cvtColor(crop, cv2.COLOR_BGR2HSV)
        hue = hsv[:, :, 0]
        saturation = hsv[:, :, 1]
        value = hsv[:, :, 2]
        turf = (35 <= hue) & (hue <= 95) & (saturation > 30) & (value > 35)
        field_line = (saturation < 45) & (value > 145)
        shadow = value < 25
        valid = ~(turf | field_line | shadow)
        if np.count_nonzero(valid) < 4:
            return None
        return np.median(hsv[valid], axis=0).astype(float)
    except Exception:
        return np.median(crop.reshape(-1, crop.shape[-1]), axis=0).astype(float)


def _cluster_two_colors(colors: np.ndarray) -> list[int]:
    try:
        from sklearn.cluster import KMeans

        model = KMeans(n_clusters=2, n_init=10, random_state=7)
        return [int(label) for label in model.fit_predict(colors)]
    except Exception:
        if colors.shape[0] < 2:
            return [0] * colors.shape[0]
        first = colors[0]
        second = colors[np.argmax(np.linalg.norm(colors - first, axis=1))]
        distances = np.stack(
            [np.linalg.norm(colors - first, axis=1), np.linalg.norm(colors - second, axis=1)],
            axis=1,
        )
        return [int(label) for label in np.argmin(distances, axis=1)]
