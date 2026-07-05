# Football Perception Optimization Guide

## Current Configuration
- Model: yolov8m.pt (medium - good balance)
- Confidence: 0.05 (very low - decent)
- Tiling: Enabled (4x3 grid, 0.25 overlap) - **SLOW**
- Image Size (imgsz): 1280 (large - more accurate but slower)

## Problem Analysis
- ✅ Decent results but not good enough
- ❌ Very slow due to tiled inference

## Optimization Options (Speed vs Accuracy Trade-off)

### 🚀 **FAST MODE** - 3-5x Faster (less accurate)
```python
config = ExtractionConfig(
    detector_model="yolov8n.pt",  # Nano model
    detector_confidence=0.05,
    detector_imgsz=640,  # Smaller image = faster
    tiled_inference=False,  # Disable tiling for speed
    frame_sample_stride=2,  # Process every 2nd frame
)
```
**Trade-off:** Less accurate but ~3-5x faster

---

### ⚖️ **BALANCED MODE** - 2x Faster, Better Accuracy
```python
config = ExtractionConfig(
    detector_model="yolov8m.pt",  # Keep medium
    detector_confidence=0.05,
    detector_imgsz=960,  # Medium resolution
    tiled_inference=False,  # Disable tiling (biggest slowdown)
    frame_sample_stride=1,  # Process all frames
)
```
**Trade-off:** Faster with reasonable accuracy

---

### 🎯 **ACCURACY MODE** - Slower but Best Results
```python
config = ExtractionConfig(
    detector_model="yolov8l.pt",  # Large model
    detector_confidence=0.03,  # Very sensitive
    detector_imgsz=1280,  # Full resolution
    tiled_inference=True,  # Use tiling for detail
    tile_grid=(3, 2),  # Fewer tiles = faster tiling
    tile_overlap=0.35,  # More overlap = better edges
    nms_iou_threshold=0.35,  # Stricter NMS = fewer false positives
)
```
**Trade-off:** Very slow but maximum accuracy

---

### 🔥 **RECOMMENDED - Best Balance**
```python
config = ExtractionConfig(
    detector_model="yolov8m.pt",  # Good balance
    detector_confidence=0.04,  # Slightly lower
    detector_imgsz=832,  # Medium-high resolution
    tiled_inference=False,  # DISABLE THIS (biggest slowdown)
    frame_sample_stride=1,
    nms_iou_threshold=0.5,  # Standard NMS
    
    # Fine-tune detection thresholds
    ball_min_confidence=0.05,  # More sensitive to ball
    player_min_track_observations=2,  # Require 2 frames min
    player_promotion_confidence=0.3,  # Lower threshold to promote players
)
```

---

## Key Optimization Levers (in order of impact)

### 1. **Tiled Inference** (BIGGEST IMPACT)
- `tiled_inference: False` = **2-3x faster** ✅ (but slightly less accurate for large images)
- Currently: `True` (4x3 grid = huge overhead)
- **Recommendation:** Turn OFF for speed boost

### 2. **Image Size (imgsz)**
- 640: Fast, decent for small objects
- 832: Good balance
- 1280: Slow, very accurate
- **Current:** 1280 (large)
- **Recommendation:** Reduce to 832-960

### 3. **Model Size**
- `yolov8n.pt`: Fast but less accurate (30 MB)
- `yolov8m.pt`: Balanced (50 MB) ← **CURRENT - GOOD**
- `yolov8l.pt`: Slow but very accurate (100 MB)
- **Recommendation:** Keep medium or go to small

### 4. **Confidence Threshold**
- Lower = more detections (more false positives, slower)
- Higher = fewer detections (more misses, faster)
- **Current:** 0.05 (very low)
- **Recommendation:** 0.04-0.05 is fine

### 5. **Frame Sampling**
- `frame_sample_stride=2`: Process every 2nd frame (2x faster)
- `frame_sample_stride=1`: Process all frames
- **Current:** 1
- **Recommendation:** Try stride=2 to halve processing time

---

## Other Tuning Parameters

### Player Detection Thresholds
```python
player_min_bbox_area=20.0          # Minimum player size
player_max_bbox_area=5000.0        # Maximum player size
player_min_aspect_ratio=0.2        # Min height/width ratio
player_max_aspect_ratio=5.0        # Max height/width ratio
player_min_track_observations=2    # Min frames to track
player_promotion_confidence=0.35   # Confidence to create new track
```

### Ball Detection Thresholds
```python
ball_min_confidence=0.06           # Minimum confidence
ball_min_bbox_area=4.0             # Minimum ball size
ball_max_bbox_area=900.0           # Maximum ball size
ball_max_player_iou=0.05           # Max overlap with player (avoid false positives)
```

### Touch Detection
```python
touch_distance=2.0                 # Distance to consider "touch"
touch_hysteresis_frames=3          # Frames to filter noise
min_touch_interval_seconds=0.12    # Min time between touches
```

---

## Quick Test Configurations

### Test 1: Speed (30 sec per 300 frames)
```python
detector_model="yolov8n.pt"
detector_imgsz=640
tiled_inference=False
frame_sample_stride=2
```

### Test 2: Balanced (45 sec per 300 frames)
```python
detector_model="yolov8m.pt"
detector_imgsz=832
tiled_inference=False
frame_sample_stride=1
```

### Test 3: Accuracy (2-3 min per 300 frames)
```python
detector_model="yolov8m.pt"
detector_imgsz=1024
tiled_inference=True
tile_grid=(3, 2)
tile_overlap=0.3
frame_sample_stride=1
```

---

## How to Test

1. Edit `testing.py` with new config
2. Run and check logs for:
   - Number of detections per frame
   - Number of players found
   - Number of game states generated
3. Check performance time in logs

## Recommendation for Your Case

Since you say results are "decent but not good enough" and it's slow:

**START HERE:**
```python
config = ExtractionConfig(
    detector_model="yolov8m.pt",
    detector_confidence=0.04,
    detector_imgsz=832,
    tiled_inference=False,  # THIS IS KEY - Turn off tiling
    frame_sample_stride=1,
)
```

This should be **2-3x faster** than current config while keeping results decent.

If still not good enough, switch to `yolov8l.pt` for better accuracy.
