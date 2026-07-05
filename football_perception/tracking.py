from __future__ import annotations

import warnings
from dataclasses import dataclass
from typing import Protocol

from .models import BoundingBox, Detection, ObjectKind, TrackedDetection


class Tracker(Protocol):
    def update(self, detections: list[Detection]) -> list[TrackedDetection]:
        ...


def bbox_iou(a: BoundingBox, b: BoundingBox) -> float:
    x1 = max(a.x1, b.x1)
    y1 = max(a.y1, b.y1)
    x2 = min(a.x2, b.x2)
    y2 = min(a.y2, b.y2)
    intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    area_a = a.width * a.height
    area_b = b.width * b.height
    union = area_a + area_b - intersection
    return 0.0 if union <= 0.0 else intersection / union


@dataclass
class _Track:
    id: int
    kind: ObjectKind
    bbox: BoundingBox
    misses: int = 0


class IoUTracker:
    """Small dependency-free fallback tracker used when ByteTrack/BoT-SORT is unavailable."""

    def __init__(self, iou_threshold: float = 0.2, max_misses: int = 20):
        self.iou_threshold = iou_threshold
        self.max_misses = max_misses
        self._next_id = 1
        self._tracks: dict[int, _Track] = {}

    def update(self, detections: list[Detection]) -> list[TrackedDetection]:
        matched_tracks: set[int] = set()
        matched_detections: set[int] = set()
        output: list[TrackedDetection] = []

        candidates: list[tuple[float, int, int]] = []
        for detection_index, detection in enumerate(detections):
            for track_id, track in self._tracks.items():
                if track.kind != detection.kind:
                    continue
                candidates.append((bbox_iou(track.bbox, detection.bbox), track_id, detection_index))

        for score, track_id, detection_index in sorted(candidates, reverse=True):
            if score < self.iou_threshold or track_id in matched_tracks or detection_index in matched_detections:
                continue
            detection = detections[detection_index]
            self._tracks[track_id].bbox = detection.bbox
            self._tracks[track_id].misses = 0
            matched_tracks.add(track_id)
            matched_detections.add(detection_index)
            output.append(self._to_tracked(track_id, detection))

        for detection_index, detection in enumerate(detections):
            if detection_index in matched_detections:
                continue
            track_id = self._next_id
            self._next_id += 1
            self._tracks[track_id] = _Track(track_id, detection.kind, detection.bbox)
            output.append(self._to_tracked(track_id, detection))

        for track_id in list(self._tracks):
            if track_id in matched_tracks:
                continue
            self._tracks[track_id].misses += 1
            if self._tracks[track_id].misses > self.max_misses:
                del self._tracks[track_id]

        return output

    def _to_tracked(self, track_id: int, detection: Detection) -> TrackedDetection:
        return TrackedDetection(track_id, detection.kind, detection.bbox, detection.confidence, detection.class_name)


def build_tracker(name: str = "bytetrack") -> Tracker:
    if name.lower() in {"iou", "simple"}:
        return IoUTracker()

    try:
        import supervision as sv
    except ImportError:
        return IoUTracker()

    if name.lower() == "bytetrack" and hasattr(sv, "ByteTrack"):
        # Suppress deprecation warning for ByteTrack
        with warnings.catch_warnings():
            warnings.filterwarnings("ignore", category=FutureWarning)
            return _SupervisionTrackerAdapter(sv.ByteTrack())
    return IoUTracker()


class _SupervisionTrackerAdapter:
    def __init__(self, tracker):
        self.tracker = tracker
        self._fallback = IoUTracker()

    def update(self, detections: list[Detection]) -> list[TrackedDetection]:
        # The supervision API changes across versions; keep this adapter conservative.
        return self._fallback.update(detections)
