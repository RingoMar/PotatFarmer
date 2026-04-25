import { FIFTEEN_SECONDS_MS } from "./utils/constants.js";

export const Actions = {
  FARM: "p",
  CDR: "cdr",
  SHOP_CDR: "shop cdr",
  SHOP_GUARD: "shop guard",
  SHOP_FERTILIZER: "shop fertilizer",
  STEAL: "steal",
  TRAMPLE: "trample",
  RANKUP: "rankup",
  PRESTIGE: "prestige",
  RANK: "rank",
} as const;

export type Command = (typeof Actions)[keyof typeof Actions];

export type CommandPlan = { command: Command; delay: number }[];

export const LevelsPlan: CommandPlan = [
  { command: Actions.RANKUP, delay: FIFTEEN_SECONDS_MS },
  { command: Actions.PRESTIGE, delay: FIFTEEN_SECONDS_MS },
];

export const ShoppingPlan: CommandPlan = [
  { command: Actions.SHOP_CDR, delay: FIFTEEN_SECONDS_MS },
  { command: Actions.SHOP_GUARD, delay: FIFTEEN_SECONDS_MS },
  { command: Actions.SHOP_FERTILIZER, delay: FIFTEEN_SECONDS_MS },
];

export const FarmPlan: CommandPlan = [
  { command: Actions.CDR, delay: FIFTEEN_SECONDS_MS },
  { command: Actions.FARM, delay: FIFTEEN_SECONDS_MS },
  { command: Actions.STEAL, delay: FIFTEEN_SECONDS_MS },
  { command: Actions.TRAMPLE, delay: FIFTEEN_SECONDS_MS },
];
