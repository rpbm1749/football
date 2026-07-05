import math
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

from football_perception.detectors import UltralyticsYOLODetector
from football_perception.extraction import (
    _build_players,
    _filter_detections_to_pitch,
    _promote_player_tracks,
    _select_ball_track,
    extract_game_states,
)
from football_perception.models import BoundingBox, Detection, ExtractionConfig, ObjectKind, Point, Team, TrackedDetection
from football_perception.pitch import (
    _layout_prior_polygon,
    _pick_horizontal_boundary,
    _pick_vertical_boundary,
)
from football_perception.teams import JerseyColorTeamAssigner, _sample_jersey_color


class FakeTiledDetector(UltralyticsYOLODetector):
    def __init__(self):
        self.confidence = 0.1
        self.imgsz = None
        self.tiled_inference = True
        self.tile_grid = (2, 2)
        self.tile_overlap = 0.25
        self.nms_iou_threshold = 0.4
        self.class_agnostic_players = True
        self.player_min_bbox_area = 20.0
        self.player_max_bbox_area = 5000.0
        self.player_min_aspect_ratio = 0.2
        self.player_max_aspect_ratio = 5.0
        self.mog2_player_candidates = False
        self.mog2_history = 120
        self.mog2_var_threshold = 16.0
        self.mog2_learning_rate = 0.01
        self.mog2_warmup_frames = 8
        self.mog2_max_foreground_ratio = 0.02
        self.mog2_min_area = 16.0
        self.mog2_max_area = 1800.0
        self._mog2 = None
        self._mog2_frames_seen = 0
        self.visual_player_candidates = False
        self.visual_player_min_area = 12.0
        self.visual_player_max_area = 1800.0
        self._pitch_bbox = None
        self._pitch_polygon = None
        self.calls = []

    def _detect_tile(self, frame, offset_x: int, offset_y: int):
        self.calls.append((offset_x, offset_y, frame.shape[1], frame.shape[0]))
        return [
            Detection(
                kind=ObjectKind.PLAYER,
                bbox=BoundingBox(offset_x + 10, offset_y + 10, offset_x + 30, offset_y + 40),
                confidence=0.8,
                class_name="bird",
            )
        ]


class FakePolygonDetector(FakeTiledDetector):
    def _detect_tile(self, frame, offset_x: int, offset_y: int):
        return [
            Detection(ObjectKind.PLAYER, BoundingBox(10, 10, 30, 40), 0.8, "bird"),
            Detection(ObjectKind.PLAYER, BoundingBox(150, 150, 180, 190), 0.9, "car"),
        ]


class FakePitchMapper:
    def contains_image_point(self, point: Point) -> bool:
        return 100 <= point.x <= 300 and 100 <= point.y <= 300

    def image_to_pitch(self, point: Point) -> Point:
        return Point(point.x / 10.0, point.y / 10.0)

    def fit(self, frame) -> None:
        pass

    def pitch_bbox(self):
        return (0, 0, 500, 500)

    def pitch_polygon(self):
        return np.array([[0, 500], [500, 500], [500, 0], [0, 0]], dtype=np.float32)


class FakeNoTouchDetector:
    def set_pitch_bbox(self, pitch_bbox):
        pass

    def set_pitch_polygon(self, pitch_polygon):
        pass

    def detect(self, frame):
        return [
            Detection(ObjectKind.PLAYER, BoundingBox(100, 100, 120, 140), 0.9, "person"),
            Detection(ObjectKind.BALL, BoundingBox(135, 135, 143, 143), 0.9, "sports ball"),
        ]


class FakeNoTouchTracker:
    def update(self, detections):
        return [
            TrackedDetection(index + 1, detection.kind, detection.bbox, detection.confidence, detection.class_name)
            for index, detection in enumerate(detections)
        ]


class FakeNoTouchDetectorComponent:
    def update(self, timestamp, players, ball):
        return None


class FakeCapture:
    def __init__(self):
        self.frames = [np.zeros((500, 500, 3), dtype=np.uint8)]
        self.index = 0

    def isOpened(self):
        return True

    def read(self):
        if self.index >= len(self.frames):
            return False, None
        frame = self.frames[self.index]
        self.index += 1
        return True, frame

    def get(self, property_id):
        return {5: 25.0, 7: len(self.frames)}.get(property_id, 0.0)

    def release(self):
        pass


class FakeCV2:
    CAP_PROP_FPS = 5
    CAP_PROP_FRAME_COUNT = 7

    def VideoCapture(self, path):
        return FakeCapture()


class FakeMOG2:
    def apply(self, roi, learningRate):
        mask = np.zeros(roi.shape[:2], dtype=np.uint8)
        mask[10:18, 20:28] = 255
        return mask


class FakeCV2ForMOG2:
    MORPH_OPEN = 2
    MORPH_CLOSE = 3

    def createBackgroundSubtractorMOG2(self, history, varThreshold, detectShadows):
        return FakeMOG2()

    def fillPoly(self, image, polygons, color):
        image[:, :] = color

    def bitwise_and(self, left, right):
        return left & right

    def medianBlur(self, image, kernel_size):
        return image

    def morphologyEx(self, image, operation, kernel):
        return image

    def connectedComponentsWithStats(self, mask, connectivity=8):
        ys, xs = np.where(mask > 0)
        stats = np.array(
            [
                [0, 0, mask.shape[1], mask.shape[0], mask.size - len(xs)],
                [int(xs.min()), int(ys.min()), int(xs.max() - xs.min() + 1), int(ys.max() - ys.min() + 1), len(xs)],
            ],
            dtype=np.int32,
        )
        return 2, np.zeros(mask.shape, dtype=np.int32), stats, None


class PerceptionPipelineTests(unittest.TestCase):
    def test_tiled_detector_uses_pitch_region_and_restores_image_coordinates(self):
        detector = FakeTiledDetector()
        detector.set_pitch_bbox((100, 200, 500, 600))

        detections = detector.detect(np.zeros((800, 1000, 3), dtype=np.uint8))

        self.assertEqual(len(detector.calls), 4)
        self.assertTrue(all(100 <= call[0] < 500 and 200 <= call[1] < 600 for call in detector.calls))
        self.assertEqual(detections[0].bbox.x1, 110)
        self.assertEqual(detections[0].bbox.y1, 210)

    def test_detector_pitch_polygon_filter_runs_before_nms_output(self):
        detector = FakePolygonDetector()
        detector.tiled_inference = False
        detector.set_pitch_polygon([(0, 0), (100, 0), (100, 100), (0, 100)])

        detections = detector.detect(np.zeros((200, 200, 3), dtype=np.uint8))

        self.assertEqual(len(detections), 1)
        self.assertEqual(detections[0].bbox.center, Point(20.0, 25.0))

    def test_extraction_pitch_filter_discards_centers_outside_polygon(self):
        detections = [
            Detection(ObjectKind.PLAYER, BoundingBox(100, 100, 120, 140), 0.7, "car"),
            Detection(ObjectKind.PLAYER, BoundingBox(10, 10, 30, 40), 0.9, "person"),
        ]

        filtered = _filter_detections_to_pitch(detections, FakePitchMapper())

        self.assertEqual(len(filtered), 1)
        self.assertEqual(filtered[0].class_name, "car")

    def test_class_agnostic_player_candidate_accepts_plausible_non_person_box(self):
        detector = FakeTiledDetector()
        bbox = BoundingBox(0, 0, 20, 40)

        self.assertEqual(detector._kind_from_class("kite", bbox), ObjectKind.PLAYER)

    def test_mog2_candidate_source_returns_pitch_bounded_player_detection(self):
        detector = FakeTiledDetector()
        detector.mog2_player_candidates = True
        detector.mog2_warmup_frames = 0
        detector.mog2_max_foreground_ratio = 0.5
        detector.mog2_min_area = 10.0
        detector.set_pitch_bbox((100, 200, 200, 300))
        detector.set_pitch_polygon([(100, 200), (200, 200), (200, 300), (100, 300)])

        with patch.dict("sys.modules", {"cv2": FakeCV2ForMOG2()}):
            detections = detector._detect_mog2_player_candidates(np.zeros((400, 400, 3), dtype=np.uint8))

        self.assertEqual(len(detections), 1)
        self.assertEqual(detections[0].class_name, "mog2")
        self.assertEqual(detections[0].bbox.x1, 120.0)
        self.assertEqual(detections[0].bbox.y1, 210.0)

    def test_player_direction_and_heading_are_derived_from_tracked_position_delta(self):
        previous_positions = {}
        pitch_mapper = FakePitchMapper()
        first = TrackedDetection(7, ObjectKind.PLAYER, BoundingBox(100, 100, 120, 140), 0.9, "person")
        second = TrackedDetection(7, ObjectKind.PLAYER, BoundingBox(130, 100, 150, 180), 0.9, "bird")

        first_player = _build_players([first], pitch_mapper, previous_positions, timestamp=0.0)[0]
        second_player = _build_players([second], pitch_mapper, previous_positions, timestamp=1.0)[0]

        self.assertEqual(first_player.team, Team.UNKNOWN)
        self.assertIsNone(first_player.movement_direction)
        self.assertAlmostEqual(second_player.movement_direction.x, 3.0 / 5.0)
        self.assertAlmostEqual(second_player.movement_direction.y, 4.0 / 5.0)
        self.assertAlmostEqual(second_player.heading_angle, math.degrees(math.atan2(4.0, 3.0)))

    def test_layout_prior_matches_corner_flag_field_region(self):
        polygon = _layout_prior_polygon(3840, 2160)

        self.assertAlmostEqual(polygon[0][0], 472.32)
        self.assertAlmostEqual(polygon[0][1], 2004.48)
        self.assertAlmostEqual(polygon[2][0], 3421.44)
        self.assertAlmostEqual(polygon[2][1], 118.8)

    def test_boundary_pickers_ignore_internal_field_lines(self):
        horizontal = [
            (120.0, 450, 118, 2900, 4),
            (505.0, 450, 503, 850, 4),
            (2000.0, 450, 1998, 850, 4),
        ]
        vertical = [
            (475.0, 473, 120, 4, 1800),
            (1920.0, 1918, 120, 4, 1800),
            (3420.0, 3418, 120, 4, 1800),
        ]

        self.assertEqual(_pick_horizontal_boundary(horizontal, 2160, top=True), 120.0)
        self.assertEqual(_pick_horizontal_boundary(horizontal, 2160, top=False), 2000.0)
        self.assertEqual(_pick_vertical_boundary(vertical, 3840, left=True), 475.0)
        self.assertEqual(_pick_vertical_boundary(vertical, 3840, left=False), 3420.0)

    def test_player_tracks_promote_after_stability_or_high_confidence(self):
        config = ExtractionConfig(player_min_track_observations=2, player_promotion_confidence=0.35)
        observations = {}
        visual = TrackedDetection(1, ObjectKind.PLAYER, BoundingBox(10, 10, 20, 20), 0.04, "visual")
        strong = TrackedDetection(2, ObjectKind.PLAYER, BoundingBox(30, 30, 50, 60), 0.8, "person")

        first_frame = _promote_player_tracks([visual, strong], observations, config)
        second_frame = _promote_player_tracks([visual], observations, config)

        self.assertEqual([track.track_id for track in first_frame], [2])
        self.assertEqual([track.track_id for track in second_frame], [1])

    def test_ball_selection_rejects_player_sized_and_overlapping_balls(self):
        config = ExtractionConfig(ball_min_confidence=0.06, ball_max_bbox_area=900.0)
        player = TrackedDetection(1, ObjectKind.PLAYER, BoundingBox(100, 100, 140, 180), 0.8, "person")
        player_sized_ball = TrackedDetection(2, ObjectKind.BALL, BoundingBox(200, 200, 250, 260), 0.9, "sports ball")
        overlapping_ball = TrackedDetection(3, ObjectKind.BALL, BoundingBox(110, 120, 118, 128), 0.9, "sports ball")
        plausible_ball = TrackedDetection(4, ObjectKind.BALL, BoundingBox(300, 300, 309, 309), 0.2, "sports ball")

        selected = _select_ball_track([player_sized_ball, overlapping_ball, plausible_ball], [player], config)

        self.assertEqual(selected.track_id, 4)

    def test_team_assignment_is_sticky_after_color_evidence(self):
        assigner = JerseyColorTeamAssigner(min_color_samples=1)
        assigner._color_samples[1].append(np.array([10.0, 200.0, 200.0]))
        assigner._color_samples[2].append(np.array([100.0, 200.0, 200.0]))
        players = [
            _player_state(1, x=20.0),
            _player_state(2, x=80.0),
        ]

        assigned = assigner.assign(players)
        first_team = assigned[0].team
        assigner._color_samples[1].append(np.array([100.0, 200.0, 200.0]))
        assigner._color_samples[2].append(np.array([10.0, 200.0, 200.0]))
        reassigned = assigner.assign(players)

        self.assertEqual(first_team, Team.LEFT)
        self.assertEqual(reassigned[0].team, first_team)

    def test_jersey_sampling_ignores_turf_and_field_lines(self):
        class FakeCV2ForSampling:
            COLOR_BGR2HSV = 40

            def cvtColor(self, crop, conversion):
                return crop

        crop = np.array(
            [
                [[60, 180, 180], [0, 10, 230], [120, 200, 200]],
                [[120, 200, 200], [120, 200, 200], [60, 180, 180]],
                [[0, 10, 230], [120, 200, 200], [60, 180, 180]],
            ],
            dtype=np.uint8,
        )
        tracked = TrackedDetection(1, ObjectKind.PLAYER, BoundingBox(0, 0, 3, 5), 0.9, "person")

        with patch.dict("sys.modules", {"cv2": FakeCV2ForSampling()}):
            sample = _sample_jersey_color(crop, tracked)

        self.assertTrue(np.array_equal(sample, np.array([120.0, 200.0, 200.0])))

    def test_extract_game_states_preserves_touch_gate(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            config = ExtractionConfig(
                detector=FakeNoTouchDetector(),
                tracker_component=FakeNoTouchTracker(),
                pitch_mapper=FakePitchMapper(),
                team_assigner=JerseyColorTeamAssigner(min_color_samples=99),
                touch_detector=FakeNoTouchDetectorComponent(),
                output_dir=Path(tmpdir),
            )

            with patch("football_perception.extraction._require_cv2", return_value=FakeCV2()):
                states = extract_game_states("fake.mp4", config)

        self.assertEqual(states, [])


def _player_state(track_id: int, x: float):
    from football_perception.models import PlayerState, Velocity

    return PlayerState(
        id=track_id,
        team=Team.UNKNOWN,
        is_goalkeeper=False,
        is_referee=False,
        position=Point(x, 30.0),
        velocity=Velocity(),
    )


if __name__ == "__main__":
    unittest.main()
