import logging
from football_perception import run_detection_diagnostics

logging.basicConfig(level=logging.INFO)

print("Running diagnostics for frames [0, 15, 30, 45, 60]...")
summaries = run_detection_diagnostics(
    "data\\vlc1.mp4",
    model_name="weights/player_detection_best.pt",
    confidence=0.01,
    frame_numbers=[50, 53, 57, 62, 66, 71, 74, 78, 82, 87, 89, 92, 97],
    tiled_inference=False,
    imgsz=1280,
    mog2_player_candidates=False,
)
print("\nDiagnostics finished!")
print("Detections drawn on images in the 'outputs/perception_debug/' directory.")
