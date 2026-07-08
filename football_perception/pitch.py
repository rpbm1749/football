from __future__ import annotations

from typing import Protocol

import numpy as np

from .models import PITCH_LENGTH, PITCH_WIDTH, Point


class PitchMapper(Protocol):
    def fit(self, frame) -> None:
        ...

    def image_to_pitch(self, point: Point) -> Point:
        ...


class HomographyPitchMapper:
    def __init__(self, pitch_length: float = PITCH_LENGTH, pitch_width: float = PITCH_WIDTH):
        self.pitch_length = pitch_length
        self.pitch_width = pitch_width
        self._homography = None
        self._frame_shape = None
        self._pitch_polygon = None

    def fit(self, frame) -> None:
        self._frame_shape = frame.shape[:2]
        self._homography = self._estimate_homography(frame)

    def image_to_pitch(self, point: Point) -> Point:
        if self._homography is None:
            return self._fallback_map(point)

        src = np.array([[[point.x, point.y]]], dtype=np.float32)
        try:
            import cv2

            dst = cv2.perspectiveTransform(src, self._homography)[0][0]
            return Point(float(np.clip(dst[0], 0, self.pitch_length)), float(np.clip(dst[1], 0, self.pitch_width)))
        except ImportError:
            return self._fallback_map(point)

    def _estimate_homography(self, frame):
        try:
            import cv2
        except ImportError:
            return None

        height, width = frame.shape[:2]
        # Hardbound stable prior boundary
        self._pitch_polygon = _layout_prior_polygon(width, height)
        return _homography_from_polygon(cv2, self._pitch_polygon, self.pitch_length, self.pitch_width)

    def pitch_polygon(self):
        return self._pitch_polygon

    def pitch_bbox(self) -> tuple[int, int, int, int] | None:
        if self._pitch_polygon is None:
            return None
        xs = self._pitch_polygon[:, 0]
        ys = self._pitch_polygon[:, 1]
        return int(np.floor(xs.min())), int(np.floor(ys.min())), int(np.ceil(xs.max())), int(np.ceil(ys.max()))

    def contains_image_point(self, point: Point) -> bool:
        if self._pitch_polygon is None:
            return True
        return _point_in_polygon(point, self._pitch_polygon)

    def _full_frame_homography(self, width: int, height: int):
        try:
            import cv2
        except ImportError:
            return None

        src = np.array([[0, height], [width, height], [width, 0], [0, 0]], dtype=np.float32)
        dst = np.array(
            [[0, self.pitch_width], [self.pitch_length, self.pitch_width], [self.pitch_length, 0], [0, 0]],
            dtype=np.float32,
        )
        return cv2.getPerspectiveTransform(src, dst)

    def _fallback_map(self, point: Point) -> Point:
        if self._frame_shape is None:
            return Point(point.x, point.y)
        height, width = self._frame_shape
        return Point(
            float(np.clip(point.x / max(width, 1) * self.pitch_length, 0, self.pitch_length)),
            float(np.clip((1.0 - point.y / max(height, 1)) * self.pitch_width, 0, self.pitch_width)),
        )


def _order_corners(points: np.ndarray) -> np.ndarray:
    sums = points.sum(axis=1)
    diffs = np.diff(points, axis=1).ravel()
    top_left = points[np.argmin(sums)]
    bottom_right = points[np.argmax(sums)]
    top_right = points[np.argmin(diffs)]
    bottom_left = points[np.argmax(diffs)]
    return np.array([bottom_left, bottom_right, top_right, top_left], dtype=np.float32)


def _homography_from_polygon(cv2, polygon: np.ndarray, pitch_length: float, pitch_width: float):
    destination = np.array(
        [
            [0.0, pitch_width],
            [pitch_length, pitch_width],
            [pitch_length, 0.0],
            [0.0, 0.0],
        ],
        dtype=np.float32,
    )
    return cv2.getPerspectiveTransform(polygon.astype(np.float32), destination)


def _estimate_boundary_line_polygon(frame, cv2) -> np.ndarray | None:
    height, width = frame.shape[:2]
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    white = cv2.inRange(hsv, (0, 0, 145), (180, 95, 255))
    white = cv2.morphologyEx(white, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))

    horizontal = cv2.morphologyEx(
        white,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (max(80, width // 12), 3)),
    )
    vertical = cv2.morphologyEx(
        white,
        cv2.MORPH_OPEN,
        cv2.getStructuringElement(cv2.MORPH_RECT, (3, max(80, height // 8))),
    )

    horizontal_lines = _line_candidates(cv2, horizontal, axis="horizontal", width=width, height=height)
    vertical_lines = _line_candidates(cv2, vertical, axis="vertical", width=width, height=height)

    top = _pick_horizontal_boundary(horizontal_lines, height, top=True)
    bottom = _pick_horizontal_boundary(horizontal_lines, height, top=False)
    left = _pick_vertical_boundary(vertical_lines, width, left=True)
    right = _pick_vertical_boundary(vertical_lines, width, left=False)

    prior = _layout_prior_polygon(width, height)
    prior_left = float(prior[0][0])
    prior_right = float(prior[1][0])
    prior_top = float(prior[2][1])
    prior_bottom = float(prior[0][1])

    left = left if _near(left, prior_left, width * 0.035) else prior_left
    right = right if _near(right, prior_right, width * 0.035) else prior_right
    top = top if _near(top, prior_top, height * 0.04) else prior_top
    bottom = bottom if _near(bottom, prior_bottom, height * 0.04) else prior_bottom

    if right - left < width * 0.45 or bottom - top < height * 0.45:
        return prior
    return np.array([[left, bottom], [right, bottom], [right, top], [left, top]], dtype=np.float32)


def _line_candidates(cv2, mask, axis: str, width: int, height: int) -> list[tuple[float, int, int, int, int]]:
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    candidates: list[tuple[float, int, int, int, int]] = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        if axis == "horizontal":
            if w < width * 0.18 or h > height * 0.05:
                continue
            if x + w < width * 0.18 or x > width * 0.82:
                continue
            candidates.append((y + h / 2.0, x, y, w, h))
        else:
            if h < height * 0.30 or w > width * 0.05:
                continue
            if y + h < height * 0.12 or y > height * 0.88:
                continue
            if x < width * 0.08 or x > width * 0.92:
                continue
            candidates.append((x + w / 2.0, x, y, w, h))
    return candidates


def _pick_horizontal_boundary(candidates: list[tuple[float, int, int, int, int]], height: int, top: bool) -> float | None:
    if not candidates:
        return None
    if top:
        usable = [candidate for candidate in candidates if candidate[0] < height * 0.35]
        return min((candidate[0] for candidate in usable), default=None)
    usable = [candidate for candidate in candidates if candidate[0] > height * 0.65]
    return max((candidate[0] for candidate in usable), default=None)


def _pick_vertical_boundary(candidates: list[tuple[float, int, int, int, int]], width: int, left: bool) -> float | None:
    if not candidates:
        return None
    if left:
        usable = [candidate for candidate in candidates if candidate[0] < width * 0.40]
        return min((candidate[0] for candidate in usable), default=None)
    usable = [candidate for candidate in candidates if candidate[0] > width * 0.60]
    return max((candidate[0] for candidate in usable), default=None)


def _near(value: float | None, target: float, tolerance: float) -> bool:
    return value is not None and abs(value - target) <= tolerance


def _layout_prior_polygon(width: int, height: int) -> np.ndarray:
    return np.array(
        [
            [0.123 * width, 0.928 * height],
            [0.877 * width, 0.928 * height],
            [0.877 * width, 0.055 * height],
            [0.123 * width, 0.055 * height],
        ],
        dtype=np.float32,
    )


def _point_in_polygon(point: Point, polygon: np.ndarray) -> bool:
    inside = False
    x = point.x
    y = point.y
    vertices = polygon.tolist()
    previous_x, previous_y = vertices[-1]
    for current_x, current_y in vertices:
        intersects = (current_y > y) != (previous_y > y)
        if intersects:
            denominator = previous_y - current_y
            if abs(denominator) < 1e-9:
                previous_x, previous_y = current_x, current_y
                continue
            slope_x = (previous_x - current_x) * (y - current_y) / denominator + current_x
            if x < slope_x:
                inside = not inside
        previous_x, previous_y = current_x, current_y
    return inside
