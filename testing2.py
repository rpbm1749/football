from football_perception import run_detection_diagnostics

run_detection_diagnostics(
    ".\\data\\D_20220220_1_1530_1560.mp4",
    confidence=0.04,
    imgsz=1280,
    tile_grid=(6, 4),
    tile_overlap=0.15,
    mog2_player_candidates=True,
    visual_player_candidates=False,
)
