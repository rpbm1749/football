# Stage 1 Football Perception

This package is a reusable perception module. It does not perform tactical reasoning, pitch control,
offside logic, passing recommendations, simulations, or Stage 2 visualization.

```python
from football_perception import extract_game_states

game_states = extract_game_states("../data/D_20220220_1_1530_1560.mp4")
```

`extract_game_states(video_path)` emits `GameState` objects only at ball-touch decision moments. It also
writes a JSON file to `outputs/perception/<video-name>.game_states.json` by default.

## Pipeline

- `detectors.py`: YOLO adapter for players and ball. Pass a custom detector through `ExtractionConfig.detector`.
- `tracking.py`: tracker abstraction. Uses a dependency-free IoU fallback; the API is ready for ByteTrack/BoT-SORT adapters.
- `pitch.py`: detects the visible green pitch and maps image points to normalized pitch coordinates:
  bottom-left `(0, 0)`, bottom-right `(100, 0)`, top-left `(0, 60)`, top-right `(100, 60)`.
- `teams.py`: clusters jersey colors into two outfield teams. Remaining three detections are assigned as left GK,
  right GK, and referee using the prototype rule.
- `touch.py`: emits touch events from stable ball-player proximity, ignoring free travel frames.
- `serialization.py`: JSON export that omits raw frame arrays and keeps a `frame_ref` to recover the original frame.

## Optional Configuration

```python
from football_perception import ExtractionConfig, extract_game_states

config = ExtractionConfig(
    detector_model="yolov8x.pt",
    detector_confidence=0.05,
    detector_imgsz=1280,
    tiled_inference=True,
    tile_grid=(4, 3),
    tile_overlap=0.25,
    class_agnostic_players=True,
    mog2_player_candidates=True,
    mog2_warmup_frames=8,
    visual_player_candidates=False,
    player_min_track_observations=2,
    tracker="bytetrack",
    save_frame_images=True,
    max_frames=500,
)

game_states = extract_game_states("../data/D_20220220_1_1530_1560.mp4", config)
```

Install runtime dependencies with:

```bash
pip install -r requirements-perception.txt
```

## Detection Diagnostics

Use this when the pipeline runs but emits no players/ball:

```python
from football_perception import run_detection_diagnostics

run_detection_diagnostics(
    "../data/D_20220220_1_1530_1560.mp4",
    confidence=0.01,
    imgsz=1280,
    tiled_inference=True,
    tile_grid=(4, 3),
    tile_overlap=0.25,
    mog2_player_candidates=True,
)
```

The diagnostic prints full-frame raw detection counts, confidence scores, tiled candidate counts,
pitch-filtered counts, tracker input counts, and writes sample frames with the detected pitch boundary
and the kept pitch-filtered candidate boxes.

For overhead footage where players are localized but mislabeled as unrelated COCO classes, keep
`class_agnostic_players=True`. The detector then treats non-ball detections inside plausible player
box-size ranges as player candidates, filters them to the pitch polygon, and lets tracking enforce
multi-frame consistency. Each `PlayerState` includes `movement_direction` as a normalized vector and
`heading_angle` in degrees, both derived from tracked position deltas rather than pose estimation.

For this camera angle, `pitch.py` prefers the four-corner-flag field rectangle instead of the broader
green turf blob, so detections on the surrounding runoff area are discarded before tracking.

Player output is track-first: visual and class-agnostic candidates must become stable tracks before
they are emitted as players. MOG2 foreground blobs inside the pitch are fused as player candidates
after a short background warmup, which helps with overhead camera misses while static lines are
suppressed by tracking, size filters, and foreground-flood protection.
Ball selection is filtered separately so low-confidence, player-sized
`sports ball` detections do not contaminate player coordinates or team assignment. Team labels are
assigned from accumulated jersey-color evidence and remain sticky per track; uncertain tracks stay
`unknown` until enough color evidence is available.
