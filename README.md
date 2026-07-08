# Football Game-State Visualizer & Perception Pipeline

### **Submission for Code Cup 2026 by ACM RVCE**

This repository contains a complete end-to-end platform for automated football match analysis. The project consists of two core components:
1. **Perception Pipeline (`football_perception`)**: A Python-based computer vision system that detects players, goalkeepers, referees, and the ball from video footage, tracks them across frames, assigns them to teams using jersey color clustering, and maps their coordinates to a standard 2D pitch coordinate space using homography projection.
2. **Interactive Visualizer (`Hackathon/`)**: A React/TypeScript web-based Game State Editor and Visualizer that allows analysts to inspect, play back, and manually edit the generated game state sequences.

---

## 🚀 Getting Started

### 1. Perception Pipeline Setup (Python)

Ensure you have Python 3.8+ installed.

1. Install the required dependencies:
   ```bash
   pip install -r requirements-perception.txt
   ```

2. Place your raw input match video at `data/vlc.mp4` and model weights at `weights/player_detection_best.pt`. (See [locations_used.txt](locations_used.txt) for more details).

3. Run the tracking pipeline to process the video and generate the tactical game state sequence JSON:
   ```bash
   python testing.py
   ```

4. Run the diagnostics tool to inspect the object detection quality on selected frames:
   ```bash
   python run_diagnostics.py
   ```
   This will draw bounding boxes and labels onto frames and save them in the `outputs/perception_debug/` directory.

### 2. Frontend Game State Visualizer Setup (React)

1. Navigate to the frontend directory:
   ```bash
   cd Hackathon
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Launch the development server:
   ```bash
   npm run dev
   ```

4. Open the visualizer in your browser and upload the generated JSON file from `outputs/perception/vlc.game_states.json` to play back and edit the tactical board sequence.

---

## 🛠️ System Architecture

* **Detection**: Custom fine-tuned YOLOv8 model optimized for soccer field objects (players, goalkeepers, referees, ball).
* **Heuristics**: Aspect-ratio and area filters that automatically reclassify misclassified tiny players and filter out background noise (shoes/turf marks).
* **Tracking**: ByteTrack association to maintain stable player identities.
* **Team Assignment**: Dynamic K-Means clustering ($k=2$) on RGB jersey color samples, with goalkeeper mapping based on pitch side and referee mapping based on class voting.
* **Projection**: Hardbound perspective homography matrix to project 2D image coordinates to standard $100\text{m} \times 60\text{m}$ pitch metrics.
