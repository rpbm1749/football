import { Ball, BallState, PlayerState, Team, type Player } from "../entities";
import { getFormationPosition, MatchPhase, MatchState } from "../match";
import { BallEngine } from "../physics";
import { PlayerAgentSystem } from "./PlayerAgentSystem";

const MATCH_CLOCK_SCALE = 30;
const HALF_TIME_SECONDS = 45 * 60;
const FULL_TIME_SECONDS = 90 * 60;
const RESTART_DELAY_SECONDS = 5;
const GOAL_RESTART_DELAY_SECONDS = 2;
const GOAL_MOUTH_TOP = 30 - 7.32 / 2;
const GOAL_MOUTH_BOTTOM = 30 + 7.32 / 2;

type PendingRestart =
  | "Goal"
  | "SecondHalf"
  | "NewMatch";

/**
 * Coordinates core top-view football simulation systems.
 */
export class FootballSimulationController {
  private readonly playerAgentSystem: PlayerAgentSystem;
  private readonly ballEngine: BallEngine;
  private pendingRestart: PendingRestart | null = null;
  private restartTimerSeconds = 0;

  /**
   * Creates the simulation controller.
   *
   * @param players Match players.
   * @param ball Match ball.
   * @param matchState Match state.
   */
  constructor(
    private readonly players: readonly Player[],
    private readonly ball: Ball,
    private readonly matchState: MatchState
  ) {
    this.ballEngine = new BallEngine(ball);
    this.playerAgentSystem = new PlayerAgentSystem(players);
    this.startMatch();
  }

  /**
   * Updates all simulation systems.
   *
   * @param deltaSeconds Simulation delta in seconds.
   */
  update(deltaSeconds: number): void {
    if (this.pendingRestart) {
      this.updateRestartDelay(deltaSeconds);
      return;
    }

    if (this.matchState.phase !== MatchPhase.Playing) {
      return;
    }

    this.matchState.tick(deltaSeconds * MATCH_CLOCK_SCALE);
    this.playerAgentSystem.update(this.ball, this.matchState, deltaSeconds);
    this.ballEngine.update(deltaSeconds);
    this.handleGoalIfScored();
    this.handleTimedMatchEvents();
  }

  private startMatch(): void {
    if (this.matchState.phase === MatchPhase.PreMatch) {
      this.matchState.transitionTo(MatchPhase.Kickoff, "Simulation kickoff");
      this.matchState.transitionTo(MatchPhase.Playing, "Simulation start");
    }
  }

  private handleGoalIfScored(): void {
    if (this.ball.ballState !== BallState.InGoal) return;

    const scoringTeam = this.ball.position.x > 50 ? Team.Home : Team.Away;
    this.matchState.addGoal(scoringTeam);
    this.matchState.clearPossession();
    this.matchState.transitionTo(MatchPhase.Kickoff, `${scoringTeam} goal`);
    this.placeBallInScoredGoal(scoringTeam);
    this.scheduleRestart("Goal", GOAL_RESTART_DELAY_SECONDS);
  }

  private handleTimedMatchEvents(): void {
    const elapsedSeconds = this.matchState.clock.elapsedSeconds;

    if (this.matchState.clock.half === 1 && elapsedSeconds >= HALF_TIME_SECONDS) {
      this.matchState.transitionTo(MatchPhase.HalfTime, "Half time");
      this.resetPlayersToFormation();
      this.resetBallForKickoff();
      this.scheduleRestart("SecondHalf", RESTART_DELAY_SECONDS);
      return;
    }

    if (elapsedSeconds >= FULL_TIME_SECONDS) {
      this.matchState.transitionTo(MatchPhase.FullTime, "Full time");
      this.resetPlayersToFormation();
      this.resetBallForKickoff();
      this.scheduleRestart("NewMatch", RESTART_DELAY_SECONDS);
    }
  }

  private updateRestartDelay(deltaSeconds: number): void {
    if (this.pendingRestart === "Goal") {
      this.animateGoalBall(deltaSeconds);
    }

    this.restartTimerSeconds -= deltaSeconds;
    if (this.restartTimerSeconds > 0 || this.pendingRestart === null) return;

    const restart = this.pendingRestart;
    this.pendingRestart = null;

    if (restart === "SecondHalf") {
      this.matchState.startSecondHalf();
      this.matchState.setElapsedSeconds(HALF_TIME_SECONDS);
      this.matchState.transitionTo(MatchPhase.Kickoff, "Second half kickoff");
      this.matchState.transitionTo(MatchPhase.Playing, "Second half started");
      return;
    }

    if (restart === "NewMatch") {
      this.matchState.reset();
      this.resetPlayersToFormation();
      this.matchState.transitionTo(MatchPhase.Kickoff, "New match kickoff");
      this.matchState.transitionTo(MatchPhase.Playing, "New match started");
      return;
    }

    this.resetPlayersToFormation();
    this.resetBallForKickoff();
    this.matchState.transitionTo(MatchPhase.Playing, "Restart after goal");
  }

  private scheduleRestart(restart: PendingRestart, delaySeconds: number): void {
    this.pendingRestart = restart;
    this.restartTimerSeconds = delaySeconds;
  }

  private resetBallForKickoff(): void {
    this.ball.resetToCenter();
    this.ball.setBallState(BallState.InPlay);
  }

  private placeBallInScoredGoal(scoringTeam: Team): void {
    const goalX = scoringTeam === Team.Home ? 101.6 : -1.6;
    this.ball.position = {
      x: goalX,
      y: Math.max(GOAL_MOUTH_TOP, Math.min(GOAL_MOUTH_BOTTOM, this.ball.position.y)),
    };
    this.ball.velocity = { x: scoringTeam === Team.Home ? 2.5 : -2.5, y: 0 };
    this.ball.spin = 0;
    this.ball.setBallState(BallState.InGoal);
    this.resetPlayersToFormation();
  }

  private animateGoalBall(deltaSeconds: number): void {
    this.ball.position = {
      x: this.ball.position.x + this.ball.velocity.x * deltaSeconds,
      y: this.ball.position.y + this.ball.velocity.y * deltaSeconds,
    };
    this.ball.velocity = {
      x: this.ball.velocity.x * 0.86,
      y: this.ball.velocity.y * 0.86,
    };
  }

  private resetPlayersToFormation(): void {
    this.players.forEach((player, index) => {
      player.position = getFormationPosition(player.team, index % 11);
      player.velocity = { x: 0, y: 0 };
      player.targetPosition = null;
      player.setPossession(false);
      player.setPlayerState(PlayerState.Idle);
    });
  }
}
