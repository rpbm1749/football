from __future__ import annotations

from collections import Counter
from pathlib import Path
from typing import Any


def run_detection_diagnostics(
    video_path: str | Path,
    output_dir: str | Path = "outputs/perception_debug",
    model_name: str = "yolov8m.pt",
    confidence: float = 0.01,
    frame_numbers: list[int] | None = None,
    imgsz: int | None = None,
    tiled_inference: bool = True,
    tile_grid: tuple[int, int] = (3, 3),
    tile_overlap: float = 0.2,
    mog2_player_candidates: bool = True,
    visual_player_candidates: bool = False,
) -> list[dict[str, Any]]:
    """Probe raw detector output without changing the extraction pipeline."""

    try:
        import cv2
    except ImportError as exc:
        raise RuntimeError("OpenCV is required for detection diagnostics.") from exc

    try:
        from ultralytics import YOLO
    except ImportError as exc:
        raise RuntimeError("Ultralytics is required for detection diagnostics.") from exc

    from .detectors import UltralyticsYOLODetector
    from .pitch import HomographyPitchMapper
    from .tracking import build_tracker

    video_path = Path(video_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    frame_numbers = frame_numbers or [0, 25, 50, 75, 100]

    print(f"[diagnostics] loading model: {model_name}")
    model = YOLO(model_name)
    print(f"[diagnostics] model loaded successfully: {type(model).__name__}")

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        raise FileNotFoundError(f"Could not open video: {video_path}")

    fps = capture.get(cv2.CAP_PROP_FPS) or 0.0
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    print(f"[diagnostics] video: {width}x{height}, fps={fps:.3f}, frames={total_frames}")
    if imgsz is None:
        print("[diagnostics] inference imgsz: ultralytics default")
    else:
        print(f"[diagnostics] inference imgsz: {imgsz}")
    print(f"[diagnostics] tiled inference: {tiled_inference}, grid={tile_grid}, overlap={tile_overlap}")
    print(f"[diagnostics] MOG2 player candidates: {mog2_player_candidates}")

    adapter = UltralyticsYOLODetector(
        model_name,
        confidence,
        imgsz=imgsz,
        tiled_inference=tiled_inference,
        tile_grid=tile_grid,
        tile_overlap=tile_overlap,
        class_agnostic_players=True,
        mog2_player_candidates=mog2_player_candidates,
        visual_player_candidates=visual_player_candidates,
    )
    adapter.model = model
    tracker = build_tracker("iou")
    pitch_mapper = HomographyPitchMapper()
    fitted_pitch = False
    summaries: list[dict[str, Any]] = []

    for frame_number in frame_numbers:
        capture.set(cv2.CAP_PROP_POS_FRAMES, frame_number)
        ok, frame = capture.read()
        if not ok:
            print(f"[diagnostics] frame {frame_number}: could not read")
            continue

        if not fitted_pitch:
            pitch_mapper.fit(frame)
            fitted_pitch = True
            if hasattr(adapter, "set_pitch_bbox") and hasattr(pitch_mapper, "pitch_bbox"):
                adapter.set_pitch_bbox(pitch_mapper.pitch_bbox())
            if hasattr(adapter, "set_pitch_polygon") and hasattr(pitch_mapper, "pitch_polygon"):
                adapter.set_pitch_polygon(pitch_mapper.pitch_polygon())
            print(f"[diagnostics] pitch bbox: {pitch_mapper.pitch_bbox()}")

        predict_kwargs: dict[str, Any] = {"conf": confidence, "verbose": False}
        if imgsz is not None:
            predict_kwargs["imgsz"] = imgsz
        raw_result = model.predict(frame, **predict_kwargs)[0]
        raw_boxes = getattr(raw_result, "boxes", None)
        raw_count = 0 if raw_boxes is None else len(raw_boxes)
        raw_names = raw_result.names or {}
        class_names: list[str] = []
        confidences: list[float] = []
        raw_box_sizes: list[tuple[float, float]] = []

        if raw_boxes is not None:
            for box in raw_boxes:
                class_name = str(raw_names.get(int(box.cls[0]), int(box.cls[0]))).lower()
                class_names.append(class_name)
                confidences.append(float(box.conf[0]))
                x1, y1, x2, y2 = [float(value) for value in box.xyxy[0]]
                raw_box_sizes.append((x2 - x1, y2 - y1))

        filtered_before_pitch = adapter.detect(frame)
        filtered = [
            detection
            for detection in filtered_before_pitch
            if not hasattr(pitch_mapper, "contains_image_point") or pitch_mapper.contains_image_point(detection.bbox.center)
        ]
        tracked = tracker.update(filtered)
        if hasattr(pitch_mapper, "pitch_polygon"):
            _draw_polygon(cv2, frame, pitch_mapper.pitch_polygon())
        for detection in filtered:
            label = f"{detection.kind.value}:{detection.class_name}"
            _draw_box(
                cv2,
                frame,
                (detection.bbox.x1, detection.bbox.y1, detection.bbox.x2, detection.bbox.y2),
                label,
                detection.confidence,
                (0, 220, 80) if detection.kind.value == "player" else (0, 220, 255),
            )
        summary = {
            "frame_number": frame_number,
            "raw_detection_count": raw_count,
            "raw_classes": dict(Counter(class_names)),
            "raw_confidences": confidences,
            "candidate_count_before_pitch_filter": len(filtered_before_pitch),
            "filtered_detection_count": len(filtered),
            "filtered_classes": dict(Counter(item.kind.value for item in filtered)),
            "candidate_sources": dict(Counter(item.class_name for item in filtered)),
            "tracker_input_count": len(filtered),
            "tracked_count": len(tracked),
            "raw_box_sizes": raw_box_sizes,
        }
        summaries.append(summary)
        print(
            "[diagnostics] frame "
            f"{frame_number}: raw={raw_count}, candidates={len(filtered_before_pitch)}, "
            f"pitch_filtered={len(filtered)}, tracked={len(tracked)}, "
            f"sources={summary['candidate_sources']}, classes={summary['raw_classes']}, "
            f"confs={[round(value, 3) for value in confidences[:12]]}"
        )

        output_path = output_dir / f"{video_path.stem}_frame_{frame_number:06d}_detections.jpg"
        cv2.imwrite(str(output_path), frame)
        print(f"[diagnostics] wrote {output_path}")

    capture.release()
    return summaries


def _draw_box(cv2, frame, box, class_name: str, confidence: float, color: tuple[int, int, int]) -> None:
    x1, y1, x2, y2 = [int(round(value)) for value in box]
    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
    cv2.putText(
        frame,
        f"{class_name} {confidence:.2f}",
        (x1, max(0, y1 - 5)),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        color,
        2,
        cv2.LINE_AA,
    )


def _draw_polygon(cv2, frame, polygon) -> None:
    if polygon is None:
        return
    import numpy as np

    points = np.array(polygon, dtype=np.int32).reshape((-1, 1, 2))
    cv2.polylines(frame, [points], isClosed=True, color=(255, 255, 0), thickness=4, lineType=cv2.LINE_AA)
