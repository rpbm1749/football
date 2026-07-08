from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol

from .models import BoundingBox, Detection, ExtractionConfig, ObjectKind, Point


class Detector(Protocol):
    def detect(self, frame) -> list[Detection]:
        ...


@dataclass(frozen=True)
class _Tile:
    x1: int
    y1: int
    x2: int
    y2: int


class UltralyticsYOLODetector:
    """YOLO adapter with optional pitch-region tiled inference."""

    PERSON_NAMES = {"person", "player", "goalkeeper", "referee"}
    BALL_NAMES = {"sports ball", "ball", "football", "soccer ball"}

    def __init__(
        self,
        model_name: str,
        confidence: float = 0.25,
        imgsz: int | None = None,
        tiled_inference: bool = True,
        tile_grid: tuple[int, int] = (3, 3),
        tile_overlap: float = 0.2,
        nms_iou_threshold: float = 0.45,
        class_agnostic_players: bool = True,
        player_min_bbox_area: float = 20.0,
        player_max_bbox_area: float = 5000.0,
        player_min_aspect_ratio: float = 0.2,
        player_max_aspect_ratio: float = 5.0,
        mog2_player_candidates: bool = True,
        mog2_history: int = 120,
        mog2_var_threshold: float = 16.0,
        mog2_learning_rate: float = 0.01,
        mog2_warmup_frames: int = 8,
        mog2_max_foreground_ratio: float = 0.02,
        mog2_min_area: float = 24.0,
        mog2_max_area: float = 1800.0,
        visual_player_candidates: bool = False,
        visual_player_min_area: float = 12.0,
        visual_player_max_area: float = 1800.0,
    ):
        try:
            from ultralytics import YOLO
        except ImportError as exc:
            raise RuntimeError(
                "Ultralytics is required for the default detector. Install dependencies from "
                "requirements-perception.txt or pass a custom detector in ExtractionConfig.detector."
            ) from exc

        self.model = YOLO(model_name)
        self.confidence = confidence
        self.imgsz = imgsz
        self.tiled_inference = tiled_inference
        self.tile_grid = tile_grid
        self.tile_overlap = tile_overlap
        self.nms_iou_threshold = nms_iou_threshold
        self.class_agnostic_players = class_agnostic_players
        self.player_min_bbox_area = player_min_bbox_area
        self.player_max_bbox_area = player_max_bbox_area
        self.player_min_aspect_ratio = player_min_aspect_ratio
        self.player_max_aspect_ratio = player_max_aspect_ratio
        self.mog2_player_candidates = mog2_player_candidates
        self.mog2_history = mog2_history
        self.mog2_var_threshold = mog2_var_threshold
        self.mog2_learning_rate = mog2_learning_rate
        self.mog2_warmup_frames = mog2_warmup_frames
        self.mog2_max_foreground_ratio = mog2_max_foreground_ratio
        self.mog2_min_area = mog2_min_area
        self.mog2_max_area = mog2_max_area
        self.visual_player_candidates = visual_player_candidates
        self.visual_player_min_area = visual_player_min_area
        self.visual_player_max_area = visual_player_max_area
        self._mog2 = None
        self._mog2_frames_seen = 0
        self._pitch_bbox: tuple[int, int, int, int] | None = None
        self._pitch_polygon: list[Point] | None = None

    def set_pitch_bbox(self, pitch_bbox: tuple[int, int, int, int] | None) -> None:
        self._pitch_bbox = pitch_bbox

    def set_pitch_polygon(self, pitch_polygon) -> None:
        if pitch_polygon is None:
            self._pitch_polygon = None
            return
        polygon = [Point(float(point[0]), float(point[1])) for point in pitch_polygon]
        self._pitch_polygon = polygon if polygon else None

    def detect(self, frame) -> list[Detection]:
        detections: list[Detection] = []
        for tile in self._tiles_for_frame(frame):
            tile_frame = frame[tile.y1 : tile.y2, tile.x1 : tile.x2]
            if tile_frame.size == 0:
                continue
            detections.extend(self._detect_tile(tile_frame, tile.x1, tile.y1))
        if self.mog2_player_candidates:
            detections.extend(self._detect_mog2_player_candidates(frame))
        if self.visual_player_candidates:
            detections.extend(self._detect_visual_player_candidates(frame))
        detections = [detection for detection in detections if self._inside_pitch(detection.bbox.center)]
        detections = _nms(detections, self.nms_iou_threshold)
        
        # Smallest box ball heuristic: if there are multiple ball detections,
        # keep only the smallest one as a ball, reclassify the rest as players
        ball_detections = [d for d in detections if d.kind == ObjectKind.BALL]
        if len(ball_detections) > 1:
            smallest_ball = min(ball_detections, key=lambda d: d.bbox.width * d.bbox.height)
            new_detections = []
            for d in detections:
                if d.kind == ObjectKind.BALL and d is not smallest_ball:
                    new_detections.append(
                        Detection(
                            kind=ObjectKind.PLAYER,
                            bbox=d.bbox,
                            confidence=d.confidence,
                            class_name="player",
                        )
                    )
                else:
                    new_detections.append(d)
            detections = new_detections
            
        return detections

    def _detect_tile(self, frame, offset_x: int, offset_y: int) -> list[Detection]:
        predict_kwargs = {"conf": self.confidence, "verbose": False}
        if self.imgsz is not None:
            predict_kwargs["imgsz"] = self.imgsz

        results = self.model.predict(frame, **predict_kwargs)
        detections: list[Detection] = []
        if not results:
            return detections

        result = results[0]
        names = result.names or {}
        boxes = getattr(result, "boxes", None)
        if boxes is None:
            return detections

        for box in boxes:
            class_id = int(box.cls[0])
            class_name = str(names.get(class_id, class_id)).lower()
            x1, y1, x2, y2 = [float(value) for value in box.xyxy[0]]
            bbox = BoundingBox(x1 + offset_x, y1 + offset_y, x2 + offset_x, y2 + offset_y)
            
            # Reclassify large ball detections as player candidates
            if class_name in self.BALL_NAMES:
                area = bbox.width * bbox.height
                if bbox.width > 18.0 or bbox.height > 24.0 or area > 350.0:
                    class_name = "player"
            
            kind = self._kind_from_class(class_name, bbox)
            if kind is None:
                continue
            detections.append(
                Detection(
                    kind=kind,
                    bbox=bbox,
                    confidence=float(box.conf[0]),
                    class_name=class_name,
                )
            )
        return detections

    def _tiles_for_frame(self, frame) -> list[_Tile]:
        height, width = frame.shape[:2]
        if not self.tiled_inference:
            return [_Tile(0, 0, width, height)]

        x1, y1, x2, y2 = self._pitch_bbox or (0, 0, width, height)
        x1 = max(0, min(width - 1, x1))
        y1 = max(0, min(height - 1, y1))
        x2 = max(x1 + 1, min(width, x2))
        y2 = max(y1 + 1, min(height, y2))

        columns, rows = self.tile_grid
        columns = max(1, columns)
        rows = max(1, rows)
        region_width = x2 - x1
        region_height = y2 - y1
        tile_width = max(1, int(region_width / columns * (1.0 + self.tile_overlap)))
        tile_height = max(1, int(region_height / rows * (1.0 + self.tile_overlap)))
        stride_x = max(1, int(region_width / columns))
        stride_y = max(1, int(region_height / rows))

        tiles: list[_Tile] = []
        for row in range(rows):
            for column in range(columns):
                tx1 = min(x2 - 1, x1 + column * stride_x)
                ty1 = min(y2 - 1, y1 + row * stride_y)
                tx2 = min(x2, tx1 + tile_width)
                ty2 = min(y2, ty1 + tile_height)
                if column == columns - 1:
                    tx1 = max(x1, x2 - tile_width)
                    tx2 = x2
                if row == rows - 1:
                    ty1 = max(y1, y2 - tile_height)
                    ty2 = y2
                tiles.append(_Tile(tx1, ty1, tx2, ty2))
        return tiles

    def _kind_from_class(self, class_name: str, bbox: BoundingBox) -> ObjectKind | None:
        if class_name in self.BALL_NAMES:
            return ObjectKind.BALL
        if class_name in self.PERSON_NAMES:
            return ObjectKind.PLAYER
        if self.class_agnostic_players and self._looks_like_overhead_player(bbox):
            return ObjectKind.PLAYER
        return None

    def _looks_like_overhead_player(self, bbox: BoundingBox) -> bool:
        area = bbox.width * bbox.height
        if area < self.player_min_bbox_area or area > self.player_max_bbox_area:
            return False
        aspect_ratio = bbox.width / max(bbox.height, 1e-6)
        return self.player_min_aspect_ratio <= aspect_ratio <= self.player_max_aspect_ratio

    def _inside_pitch(self, point: Point) -> bool:
        if self._pitch_polygon is None:
            return True
        return _point_in_polygon(point, self._pitch_polygon)

    def _detect_visual_player_candidates(self, frame) -> list[Detection]:
        try:
            import cv2
            import numpy as np
        except ImportError:
            return []

        height, width = frame.shape[:2]
        x1, y1, x2, y2 = self._pitch_bbox or (0, 0, width, height)
        x1 = max(0, min(width - 1, x1))
        y1 = max(0, min(height - 1, y1))
        x2 = max(x1 + 1, min(width, x2))
        y2 = max(y1 + 1, min(height, y2))
        roi = frame[y1:y2, x1:x2]
        if roi.size == 0:
            return []

        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
        green = cv2.inRange(hsv, (35, 30, 35), (95, 255, 255)) > 0
        saturated_object = (hsv[:, :, 1] > 45) & (hsv[:, :, 2] > 40)
        mask = (saturated_object & ~green).astype("uint8") * 255

        if self._pitch_polygon is not None:
            polygon = np.array([[point.x - x1, point.y - y1] for point in self._pitch_polygon], dtype=np.int32)
            pitch_mask = np.zeros(mask.shape, dtype="uint8")
            cv2.fillPoly(pitch_mask, [polygon], 255)
            mask = cv2.bitwise_and(mask, pitch_mask)

        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        component_count, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)

        detections: list[Detection] = []
        for component_id in range(1, component_count):
            bx, by, bw, bh, area = stats[component_id]
            if area < self.visual_player_min_area or area > self.visual_player_max_area:
                continue
            if bw < 3 or bh < 3 or bw > 90 or bh > 90:
                continue
            aspect_ratio = bw / max(float(bh), 1e-6)
            if aspect_ratio < 0.15 or aspect_ratio > 4.0:
                continue
            bbox = BoundingBox(float(x1 + bx), float(y1 + by), float(x1 + bx + bw), float(y1 + by + bh))
            if not self._inside_pitch(bbox.center):
                continue
            detections.append(Detection(ObjectKind.PLAYER, bbox, 0.04, "visual"))
        return detections

    def _detect_mog2_player_candidates(self, frame) -> list[Detection]:
        try:
            import cv2
            import numpy as np
        except ImportError:
            return []

        if self._mog2 is None:
            self._mog2 = cv2.createBackgroundSubtractorMOG2(
                history=max(1, int(self.mog2_history)),
                varThreshold=float(self.mog2_var_threshold),
                detectShadows=True,
            )

        height, width = frame.shape[:2]
        x1, y1, x2, y2 = self._pitch_bbox or (0, 0, width, height)
        x1 = max(0, min(width - 1, x1))
        y1 = max(0, min(height - 1, y1))
        x2 = max(x1 + 1, min(width, x2))
        y2 = max(y1 + 1, min(height, y2))
        roi = frame[y1:y2, x1:x2]
        if roi.size == 0:
            return []

        foreground = self._mog2.apply(roi, learningRate=float(self.mog2_learning_rate))
        self._mog2_frames_seen += 1
        mask = (foreground == 255).astype("uint8") * 255
        if self._mog2_frames_seen <= max(0, int(self.mog2_warmup_frames)):
            return []
        if mask.mean() / 255.0 > float(self.mog2_max_foreground_ratio):
            return []

        if self._pitch_polygon is not None:
            polygon = np.array([[point.x - x1, point.y - y1] for point in self._pitch_polygon], dtype=np.int32)
            pitch_mask = np.zeros(mask.shape, dtype="uint8")
            cv2.fillPoly(pitch_mask, [polygon], 255)
            mask = cv2.bitwise_and(mask, pitch_mask)

        mask = cv2.medianBlur(mask, 3)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
        component_count, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)

        detections: list[Detection] = []
        for component_id in range(1, component_count):
            bx, by, bw, bh, area = stats[component_id]
            if area < self.mog2_min_area or area > self.mog2_max_area:
                continue
            if bw < 3 or bh < 3 or bw > 100 or bh > 100:
                continue
            aspect_ratio = bw / max(float(bh), 1e-6)
            if aspect_ratio < 0.15 or aspect_ratio > 4.5:
                continue
            bbox = BoundingBox(float(x1 + bx), float(y1 + by), float(x1 + bx + bw), float(y1 + by + bh))
            if not self._inside_pitch(bbox.center):
                continue
            detections.append(Detection(ObjectKind.PLAYER, bbox, 0.05, "mog2"))
        return detections


class NullDetector:
    def __init__(self, message: str):
        self.message = message

    def detect(self, frame) -> list[Detection]:
        raise RuntimeError(self.message)


def build_detector(config: ExtractionConfig) -> Detector:
    if config.detector is not None:
        return config.detector
    return UltralyticsYOLODetector(
        config.detector_model,
        config.detector_confidence,
        imgsz=config.detector_imgsz,
        tiled_inference=config.tiled_inference,
        tile_grid=config.tile_grid,
        tile_overlap=config.tile_overlap,
        nms_iou_threshold=config.nms_iou_threshold,
        class_agnostic_players=config.class_agnostic_players,
        player_min_bbox_area=config.player_min_bbox_area,
        player_max_bbox_area=config.player_max_bbox_area,
        player_min_aspect_ratio=config.player_min_aspect_ratio,
        player_max_aspect_ratio=config.player_max_aspect_ratio,
        mog2_player_candidates=config.mog2_player_candidates,
        mog2_history=config.mog2_history,
        mog2_var_threshold=config.mog2_var_threshold,
        mog2_learning_rate=config.mog2_learning_rate,
        mog2_warmup_frames=config.mog2_warmup_frames,
        mog2_max_foreground_ratio=config.mog2_max_foreground_ratio,
        mog2_min_area=config.mog2_min_area,
        mog2_max_area=config.mog2_max_area,
        visual_player_candidates=config.visual_player_candidates,
        visual_player_min_area=config.visual_player_min_area,
        visual_player_max_area=config.visual_player_max_area,
    )


def _nms(detections: list[Detection], iou_threshold: float) -> list[Detection]:
    kept: list[Detection] = []
    for detection in sorted(detections, key=lambda item: item.confidence, reverse=True):
        duplicate = False
        for kept_detection in kept:
            if detection.kind == kept_detection.kind and _same_object(detection.bbox, kept_detection.bbox, iou_threshold):
                duplicate = True
                break
        if not duplicate:
            kept.append(detection)
    return kept


def _iou(a: BoundingBox, b: BoundingBox) -> float:
    x1 = max(a.x1, b.x1)
    y1 = max(a.y1, b.y1)
    x2 = min(a.x2, b.x2)
    y2 = min(a.y2, b.y2)
    intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    union = a.width * a.height + b.width * b.height - intersection
    return 0.0 if union <= 0.0 else intersection / union


def _same_object(a: BoundingBox, b: BoundingBox, iou_threshold: float) -> bool:
    if _iou(a, b) >= iou_threshold:
        return True
    center_distance = ((a.center.x - b.center.x) ** 2 + (a.center.y - b.center.y) ** 2) ** 0.5
    scale = max(min(a.width, b.width), min(a.height, b.height), 1.0)
    return center_distance <= scale * 0.6


def _point_in_polygon(point: Point, polygon: list[Point]) -> bool:
    inside = False
    previous = polygon[-1]
    for current in polygon:
        intersects = (current.y > point.y) != (previous.y > point.y)
        if intersects:
            denominator = previous.y - current.y
            if abs(denominator) < 1e-9:
                previous = current
                continue
            boundary_x = (previous.x - current.x) * (point.y - current.y) / denominator + current.x
            if point.x < boundary_x:
                inside = not inside
        previous = current
    return inside
