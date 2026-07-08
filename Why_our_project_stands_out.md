# Why Our Project Stands Out: Spatial Dominance in Football Analysis

Conventional football analytics is dominated by **action-based metrics**—expected goals (xG), passing accuracy, tackles won, and goals conceded. While easy to quantify, these metrics share a fundamental limitation: they only capture what happens *on the ball*. 

In a 90-minute match, an individual player spends an average of only **2 to 3 minutes** in possession of the ball. The remaining 87+ minutes are spent off-the-ball, moving to create, occupy, or block space. 

Our project stands out because it shifts the analytical focus from **actions** to **space and structure**.

---

## 1. Space-Oriented vs. Action-Oriented Analysis

Consider a defensive sequence where a team concedes a goal:
* **The Action View**: Focuses on the final error—a failed tackle, a goalkeeper slip, or a defensive block missed. It concludes that the defense is weak because they conceded a goal.
* **Our Spatial View**: Examines the structure of the entire defensive unit leading up to the shot. Was the defensive line stretched too wide? Did the midfielders fail to occupy Zone 14 (the crucial space outside the box)? Was there a structural collapse in the half-spaces?

By tracking the continuous coordinates of all players and projecting them onto a 2D pitch, our tool evaluates the **structural soundness** of the team. A team can defend perfectly for 89 minutes and concede due to an individual fluke; conversely, they can have terrible defensive structure but keep a clean sheet because the opponent missed a sitter. Our system evaluates the team's shape and spacing, which is a far more reliable indicator of long-term tactical success than simple goals-conceded metrics.

---

## 2. Structural Metrics over Scoreboard Metrics

By mapping continuous 2D coordinates, our platform enables the analysis of advanced structural metrics that actions alone cannot reveal:

* **Line Compactness**: Measuring the distance between the defensive line and the midfield line to detect if the team is leaving gaps for opponents to exploit.
* **Passing Lane Accessibility**: Assessing whether the structure of the team in possession is providing enough passing options to the ball carrier, or if the passing lanes are blocked.
* **Spatial Control (Voronoi/Territorial Dominance)**: Calculating which parts of the pitch are under the control of which team based on player positioning and velocities. This tells you who dominates the "half-spaces" and the "box," regardless of who has the ball.

---

## 3. Empowers the Tactical Board

Instead of presenting coaches with spreadsheets of percentages, our platform visualizes the structure dynamically. By providing an interactive tactical editor directly integrated with the tracking pipeline, analysts can:
1. Automatically extract the actual game state from a video clip.
2. Edit the board coordinates to run "what-if" scenarios (e.g., *"If our right-back had positioned himself 3 meters narrower, could he have cut off that pass?"*).
3. Seamlessly explain structural positioning errors directly to the players.

This is why our project stands out: we do not just count actions; we **model the occupation of space itself**, which is the true language of football tactics.
