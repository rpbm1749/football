import { PitchCanvas } from "./components/PitchCanvas";
import { GameStateEditorUI } from "./components/GameStateEditorUI";

function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", position: "relative", background: "#0a120e", overflow: "hidden" }}>
      <PitchCanvas />
      <GameStateEditorUI />
    </div>
  );
}

export default App;
