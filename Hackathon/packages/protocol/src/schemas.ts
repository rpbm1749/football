import { DEFAULT_MODEL, LAYER_NAMES, type GameState, type PhysicsModel } from "@football/engine";
import { z } from "zod";

/**
 * Runtime validation for everything that crosses the network. Bounds are
 * generous (perception output can place players slightly off the pitch) but
 * stop malformed or hostile payloads before they reach a worker thread.
 */

export const TeamSchema = z.enum(["A", "B", "NONE"]);

export const PlayerSchema = z.object({
  id: z.string().min(1).max(64),
  team: TeamSchema,
  goalkeeper: z.boolean(),
  referee: z.boolean(),
  x: z.number().min(-50).max(150),
  y: z.number().min(-50).max(110),
  heading_angle: z.number().min(-3600).max(3600),
  jerseyNumber: z.string().max(8).optional(),
});

export const BallSchema = z.object({
  x: z.number().min(-50).max(150),
  y: z.number().min(-50).max(110),
  playerIdWhoHasPossession: z.string().max(64).nullable(),
});

export const GameStateSchema: z.ZodType<GameState> = z.object({
  players: z.array(PlayerSchema).max(40),
  ball: BallSchema,
  name: z.string().max(200).optional(),
});

/** Every PhysicsModel constant may be overridden per request. */
export const ModelOverridesSchema = z
  .object(
    Object.fromEntries(
      Object.keys(DEFAULT_MODEL).map((key) => [key, z.number().nonnegative().max(10_000).optional()]),
    ) as Record<keyof PhysicsModel, z.ZodOptional<z.ZodNumber>>,
  )
  .strict();

export const LayerNameSchema = z.enum(LAYER_NAMES);

export const MAX_SEQUENCE_BOARDS = 2000;

export const AnalyzeBoardRequestSchema = z.object({
  board: GameStateSchema,
  layers: z.array(LayerNameSchema).min(1).optional(),
  model: ModelOverridesSchema.optional(),
});

export const AnalyzeSequenceRequestSchema = z.object({
  boards: z.array(GameStateSchema).min(1).max(MAX_SEQUENCE_BOARDS),
  model: ModelOverridesSchema.optional(),
});

export type AnalyzeBoardRequest = z.infer<typeof AnalyzeBoardRequestSchema>;
export type AnalyzeSequenceRequest = z.infer<typeof AnalyzeSequenceRequestSchema>;

// --- Scenarios -----------------------------------------------------------------

/** Scenario names are file-like ("my_scenario.json"): no paths, no traversal. */
export const ScenarioNameSchema = z
  .string()
  .regex(/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,95}\.json$/, "must be a simple file name ending in .json")
  .refine((name) => !name.includes(".."), "must not contain '..'");

export const ScenarioSequenceSchema = z.object({
  type: z.literal("ScenarioSequence"),
  id: z.string().max(200),
  name: z.string().max(200),
  boards: z.array(GameStateSchema).max(MAX_SEQUENCE_BOARDS),
});

/** A saved scenario is either a single board or a named sequence of boards. */
export const ScenarioDocumentSchema = z.union([ScenarioSequenceSchema, GameStateSchema]);
export type ScenarioDocument = z.infer<typeof ScenarioDocumentSchema>;

export const DuplicateScenarioRequestSchema = z.object({ newName: ScenarioNameSchema });

// --- Reports -------------------------------------------------------------------

export const TacticalReportRequestSchema = z.object({
  boards: z.array(GameStateSchema).min(1).max(MAX_SEQUENCE_BOARDS),
  model: ModelOverridesSchema.optional(),
});
export type TacticalReportRequest = z.infer<typeof TacticalReportRequestSchema>;

// --- Live analysis (WebSocket) ---------------------------------------------------

export const LiveAnalyzeMessageSchema = z.object({
  type: z.literal("analyze"),
  /** Client-chosen, increasing request id; replies echo it. */
  id: z.number().int().nonnegative(),
  board: GameStateSchema,
  layers: z.array(LayerNameSchema).min(1).optional(),
  model: ModelOverridesSchema.optional(),
});
export const LiveClientMessageSchema = z.discriminatedUnion("type", [LiveAnalyzeMessageSchema]);
export type LiveClientMessage = z.infer<typeof LiveClientMessageSchema>;
