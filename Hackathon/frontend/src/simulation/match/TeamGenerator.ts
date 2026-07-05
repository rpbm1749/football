/**
 * TeamGenerator.ts
 *
 * Generates two teams (Home and Away) with 11 players each in a 4-3-3 formation.
 * Populates players with appropriate roles, positions, and technical attributes.
 */

import { Player, Goalkeeper } from "../entities";
import type { PlayerConfig, GoalkeeperConfig } from "../entities";
import { Team, PlayerRole } from "../entities/EntityTypes";
import type { Vec2 } from "../entities/EntityTypes";
import { DeterministicRandom } from "./DeterministicRandom";
import { FORMATION_433 } from "./Formation433";

// Interface mapping specific roles to their starting positions
interface PositionMapping {
  role: PlayerRole;
  homePos: Vec2;
  awayPos: Vec2; // Away positions are mirrored horizontally, and vertically to maintain left/right relative to team facing
}

const formation433: readonly PositionMapping[] = FORMATION_433;

/**
 * Generates deterministic football squads for match setup.
 */
export class TeamGenerator {
  /**
   * Generates a full team of 11 players.
   * @param team Team.Home or Team.Away
   * @param prefix Prefix for the player names (e.g. "T1" or "T2")
   * @param rng Deterministic random source used for attribute variation.
   * @returns Ordered squad of 11 players.
   */
  static generateTeam(
    team: Team,
    prefix: string,
    rng: DeterministicRandom = new DeterministicRandom(team === Team.Home ? 101 : 202)
  ): Player[] {
    const players: Player[] = [];
    
    formation433.forEach((mapping, index) => {
      const isHome = team === Team.Home;
      const pos = isHome ? mapping.homePos : mapping.awayPos;
      const id = `${prefix}P${index + 1}`;
      const name = id; // T1P1, T2P1, etc.
      const jerseyNumber = index + 1;
      
      if (mapping.role === PlayerRole.Goalkeeper) {
        const config: GoalkeeperConfig = {
          speed: rng.nextInt(5, 7),
          acceleration: rng.nextInt(3, 5),
          stamina: 100,
          jerseyNumber,
          vision: rng.nextInt(40, 70),
          passing: rng.nextInt(40, 70),
          shooting: rng.nextInt(10, 30),
          dribbling: rng.nextInt(20, 40),
          defending: rng.nextInt(50, 70),
          ballControl: rng.nextInt(50, 80),
          diveReach: 4,
          handling: rng.nextInt(70, 95)
        };
        players.push(new Goalkeeper(id, name, team, pos, config));
      } else {
        // Base attributes depending on role to make it somewhat realistic
        let speed = 8;
        let defending = 50;
        let shooting = 50;
        let passing = 60;
        
        switch (mapping.role) {
          case PlayerRole.CB:
            speed = rng.nextInt(6, 8);
            defending = rng.nextInt(80, 95);
            shooting = rng.nextInt(20, 40);
            break;
          case PlayerRole.LB:
          case PlayerRole.RB:
          case PlayerRole.LW:
          case PlayerRole.RW:
            speed = rng.nextInt(8, 10); // Wingers and fullbacks are fast
            defending = mapping.role.includes("B") ? rng.nextInt(70, 85) : rng.nextInt(30, 50);
            break;
          case PlayerRole.CDM:
          case PlayerRole.CM:
          case PlayerRole.CAM:
            speed = rng.nextInt(7, 9);
            passing = rng.nextInt(80, 95);
            defending = mapping.role === PlayerRole.CDM ? rng.nextInt(75, 90) : rng.nextInt(50, 70);
            break;
          case PlayerRole.ST:
            speed = rng.nextInt(8, 10);
            shooting = rng.nextInt(85, 95);
            defending = rng.nextInt(20, 40);
            break;
        }

        const config: PlayerConfig = {
          speed,
          acceleration: speed / 2, // simple heuristic
          stamina: 100,
          jerseyNumber,
          vision: rng.nextInt(passing - 10, passing + 10),
          passing: rng.nextInt(passing - 5, passing + 5),
          shooting: rng.nextInt(shooting - 5, shooting + 5),
          dribbling: rng.nextInt(60, 90),
          defending: rng.nextInt(defending - 5, defending + 5),
          ballControl: rng.nextInt(70, 95)
        };
        
        players.push(new Player(id, name, team, mapping.role, pos, config));
      }
    });

    return players;
  }

  /**
   * Generates both Home and Away teams and returns a combined array.
   *
   * @param seed Deterministic seed for both squads.
   * @returns Ordered match player list.
   */
  static generateMatchSquads(seed = 433): Player[] {
    const rng = new DeterministicRandom(seed);
    const homeTeam = this.generateTeam(Team.Home, "T1", rng);
    const awayTeam = this.generateTeam(Team.Away, "T2", rng);
    
    return [...homeTeam, ...awayTeam];
  }
}
