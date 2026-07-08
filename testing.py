import logging
from football_perception import ExtractionConfig, extract_game_states

# Configure logging to show DEBUG level messages
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

logger.info("Starting football perception extraction...")

config = ExtractionConfig(
    detector_model="weights/player_detection_best.pt",
    detector_confidence=0.04,
    detector_imgsz=1280,
    tiled_inference=False,
    class_agnostic_players=False,
    mog2_player_candidates=False,
    visual_player_candidates=False,
    tracker="bytetrack",
)

try:
    game_states = extract_game_states("data/vlc.mp4", config)
    logger.info(f"Extraction completed successfully! Generated {len(game_states)} game states.")
    for i, state in enumerate(game_states[:5]):
        logger.info(f"  State {i}: timestamp={state.timestamp:.2f}s, frame={state.frame_number}, players={len(state.players)}, ball={'present' if state.ball else 'absent'}")
    if len(game_states) > 5:
        logger.info(f"  ... and {len(game_states) - 5} more states")
except Exception as e:
    logger.error(f"Extraction failed: {e}", exc_info=True)
    raise