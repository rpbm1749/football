import { BallState, Team, type Ball, type Player } from "../entities";
import type { MatchState } from "../match";
import { Dribble, Pass, Receive, Shoot } from "../actions";
import { FormationMovementSystem } from "./FormationMovementSystem";
import { PlayerAgent } from "./PlayerAgent";
import { vecDistance, vecLength } from "./SimulatorMath";
import type { AgentIntent } from "./PlayerAgentTypes";

const RECEIVE_RADIUS = 1.8;
const LOOSE_BALL_RADIUS = 2.2;
const PASS_COOLDOWN_SECONDS = 1.6;
const SHOT_COOLDOWN_SECONDS = 2.2;

/**
 * Runs autonomous think loops for all players.
 */
export class PlayerAgentSystem {
  private readonly agents: PlayerAgent[];
  private readonly movementSystem = new FormationMovementSystem();
  private readonly actionCooldowns = new Map<string, number>();

  /**
   * Creates one autonomous agent per player.
   *
   * @param players Players to control.
   */
  constructor(private readonly players: readonly Player[]) {
    this.agents = players.map((player, index) => new PlayerAgent(player, index));
  }

  /**
   * Updates every player agent and applies their selected mechanics.
   *
   * @param ball Match ball.
   * @param matchState Match state.
   * @param deltaSeconds Simulation delta in seconds.
   */
  update(ball: Ball, matchState: MatchState, deltaSeconds: number): void {
    this.tickCooldowns(deltaSeconds);
    this.ensurePossession(ball, matchState);

    const intents = this.agents.map((agent) =>
      agent.think({
        players: this.players,
        ball,
        matchState,
        deltaSeconds,
      })
    );

    this.movementSystem.updateFromIntents(this.players, intents, deltaSeconds);
    this.syncPossessedBall(ball, matchState);
    this.applyBallActions(intents, ball, matchState);
  }

  private ensurePossession(ball: Ball, matchState: MatchState): void {
    if (matchState.possession.playerId !== null) return;
    if (vecLength(ball.velocity) > 0.25 && ball.ballState !== BallState.Dead) return;

    const nearest = this.findNearestPlayer(ball);
    if (!nearest) return;
    if (vecDistance(nearest.position, ball.position) > LOOSE_BALL_RADIUS) return;

    nearest.setPossession(true);
    matchState.setPossession(nearest.team, nearest.id);
    ball.registerTouch(nearest.id, nearest.team);
    ball.setBallState(BallState.InPlay);
  }

  private applyBallActions(
    intents: readonly AgentIntent[],
    ball: Ball,
    matchState: MatchState
  ): void {
    const currentPossessorId = matchState.possession.playerId;
    const passIntent = intents.find(
      (intent) => intent.player.id === currentPossessorId && intent.action === "Pass"
    );

    if (passIntent?.ballTarget) {
      if (this.isOnCooldown(passIntent.player.id)) {
        this.syncPossessedBall(ball, matchState);
        return;
      }
      this.clearPlayerPossession();
      Pass({
        player: passIntent.player,
        ball,
        target: passIntent.ballTarget,
        power: 0.68,
      });
      this.actionCooldowns.set(passIntent.player.id, PASS_COOLDOWN_SECONDS);
      matchState.clearPossession();
      return;
    }

    const shootIntent = intents.find(
      (intent) => intent.player.id === currentPossessorId && intent.action === "Shoot"
    );

    if (shootIntent?.ballTarget) {
      if (this.isOnCooldown(shootIntent.player.id)) {
        this.syncPossessedBall(ball, matchState);
        return;
      }
      this.clearPlayerPossession();
      Shoot({
        player: shootIntent.player,
        ball,
        target: shootIntent.ballTarget,
        power: 0.82,
      });
      this.actionCooldowns.set(shootIntent.player.id, SHOT_COOLDOWN_SECONDS);
      matchState.clearPossession();
      return;
    }

    const dribbleIntent = intents.find(
      (intent) => intent.player.id === currentPossessorId && intent.action === "Dribble"
    );

    if (dribbleIntent?.ballTarget) {
      Dribble({
        player: dribbleIntent.player,
        ball,
        target: dribbleIntent.ballTarget,
        power: 0.45,
      });
      matchState.setPossession(dribbleIntent.player.team, dribbleIntent.player.id);
      return;
    }

    const receiver = this.findNearestPlayer(ball);
    if (receiver && vecDistance(receiver.position, ball.position) <= RECEIVE_RADIUS) {
      Receive({ player: receiver, ball });
      for (const player of this.players) {
        player.setPossession(player.id === receiver.id);
      }
      matchState.setPossession(receiver.team, receiver.id);
    } else if (ball.ballState !== BallState.InGoal) {
      matchState.setPossession(Team.None, null);
    }
  }

  private findNearestPlayer(ball: Ball): Player | null {
    let nearest: Player | null = null;
    let nearestDistance = Infinity;

    for (const player of this.players) {
      const distance = vecDistance(player.position, ball.position);
      if (distance < nearestDistance) {
        nearest = player;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  private clearPlayerPossession(): void {
    for (const player of this.players) {
      player.setPossession(false);
    }
  }

  private syncPossessedBall(ball: Ball, matchState: MatchState): void {
    const possessor = this.players.find((player) => player.id === matchState.possession.playerId);
    if (!possessor || ball.ballState === BallState.InGoal) return;

    const speed = vecLength(possessor.velocity);
    const facing = speed > 0.1
      ? { x: possessor.velocity.x / speed, y: possessor.velocity.y / speed }
      : { x: possessor.team === Team.Home ? 1 : -1, y: 0 };

    ball.position = {
      x: possessor.position.x + facing.x * 1.15,
      y: possessor.position.y + facing.y * 1.15,
    };
    ball.velocity = { ...possessor.velocity };
    ball.registerTouch(possessor.id, possessor.team);
    ball.setBallState(BallState.InPlay);

    for (const player of this.players) {
      player.setPossession(player.id === possessor.id);
    }
  }

  private tickCooldowns(deltaSeconds: number): void {
    for (const [playerId, cooldown] of this.actionCooldowns) {
      const next = cooldown - deltaSeconds;
      if (next <= 0) {
        this.actionCooldowns.delete(playerId);
      } else {
        this.actionCooldowns.set(playerId, next);
      }
    }
  }

  private isOnCooldown(playerId: string): boolean {
    return (this.actionCooldowns.get(playerId) ?? 0) > 0;
  }
}
