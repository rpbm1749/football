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
    detector_model="yolov8m.pt",
    tracker="bytetrack",
    max_frames=300,
)

try:
    game_states = extract_game_states("D:\\Projects_final\\ACM_Hackathon\\data\\D_20220220_1_1590_1620.mp4", config)
    logger.info(f"Extraction completed successfully! Generated {len(game_states)} game states.")
    for i, state in enumerate(game_states[:5]):
        logger.info(f"  State {i}: timestamp={state.timestamp:.2f}s, frame={state.frame_number}, players={len(state.players)}, ball={'present' if state.ball else 'absent'}")
    if len(game_states) > 5:
        logger.info(f"  ... and {len(game_states) - 5} more states")
except Exception as e:
    logger.error(f"Extraction failed: {e}", exc_info=True)
    raise