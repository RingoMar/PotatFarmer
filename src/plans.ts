import { FIFTEEN_SECONDS_MS } from "./utils/constants.js";

export const Actions = {
  FARM: "p",
  CDR: "cdr",
  SHOP_CDR: "shop cdr",
  SHOP_GUARD: "shop guard",
  SHOP_FERTILIZER: "shop fertilizer",
  STEAL: "steal",
  RANKUP: "rankup",
  PRESTIGE: "prestige",
  RANK: "rank",
  TRAMPLE: "trample",
} as const;

export type Command = (typeof Actions)[keyof typeof Actions];

export const Rank = {
  Bankrupt: 0,
  BackyardGarden: 1,
  Greenhouse: 2,
  AcreFarm: 3,
  TenAcreFarm: 4,
  PotatoPlantation: 5,
  Industrial: 6,
} as const;

export type RankValue = (typeof Rank)[keyof typeof Rank];

const RANK_COSTS: Record<RankValue, number> = {
  [Rank.Bankrupt]: -1000,
  [Rank.BackyardGarden]: 200,
  [Rank.Greenhouse]: 1000,
  [Rank.AcreFarm]: 5000,
  [Rank.TenAcreFarm]: 10000,
  [Rank.PotatoPlantation]: 25000,
  [Rank.Industrial]: 50000,
};

const SHOP_BASE_COSTS = {
  [Actions.SHOP_CDR]: 500,
  [Actions.SHOP_GUARD]: 1500,
  [Actions.SHOP_FERTILIZER]: 2000,
} as const;

const LOW_BALANCE_RESERVE = 500;
const CDR_MIN_SURPLUS = 1000;
const SHOP_MIN_SURPLUS = 2500;
const PRESTIGE_BASE_COST = 100000;
const PRESTIGE_STEP_COST = 20000;

// cdr has no server-side rejection if you can't afford it — it just silently
// goes negative. Cost is floor(15 * rank * (1 + prestige * 0.1)).
function cdrCost(rank: RankValue, prestige: number): number {
  const effectiveRank = rank !== Rank.Bankrupt ? rank : 5;
  const prestigeMulti = prestige >= 1 ? 1 + prestige * 0.1 : 1;
  return Math.floor(15 * effectiveRank * prestigeMulti);
}

function nextRankCost(rank: RankValue): number | null {
  if (rank >= Rank.Industrial) return null;
  return RANK_COSTS[(rank + 1) as RankValue] ?? null;
}

function shopCost(command: Command, rank: RankValue): number {
  const baseCost = SHOP_BASE_COSTS[command as keyof typeof SHOP_BASE_COSTS];
  if (!baseCost) return 0;
  return baseCost * Math.max(1, rank);
}

function isShopCommand(command: Command): boolean {
  return command === Actions.SHOP_CDR || command === Actions.SHOP_GUARD || command === Actions.SHOP_FERTILIZER;
}

function hasSurplus(potatoes: number, cost: number, surplus: number): boolean {
  return potatoes - cost >= LOW_BALANCE_RESERVE + surplus;
}

export function shouldRun(command: Command, { potatoes, rank, prestige }: { potatoes: number; rank: RankValue; prestige: number }): boolean {
  const nextCost = nextRankCost(rank);

  if (command === Actions.RANKUP) {
    return nextCost !== null && potatoes >= nextCost;
  }

  if (command === Actions.PRESTIGE) {
    return rank === Rank.Industrial && potatoes >= PRESTIGE_BASE_COST + PRESTIGE_STEP_COST * prestige;
  }

  if (command === Actions.FARM || command === Actions.TRAMPLE) {
    return true;
  }

  if (command === Actions.STEAL) {
    return potatoes >= LOW_BALANCE_RESERVE;
  }

  if (command === Actions.CDR) {
    return hasSurplus(potatoes, cdrCost(rank, prestige), CDR_MIN_SURPLUS);
  }

  if (isShopCommand(command)) {
    return hasSurplus(potatoes, shopCost(command, rank), SHOP_MIN_SURPLUS);
  }

  return true;
}

export interface PlanStep {
  command: Command;
  delay: number;
}

export type CommandPlan = PlanStep[];

export const LevelsPlan: CommandPlan = [
  { command: Actions.RANKUP, delay: FIFTEEN_SECONDS_MS },
  { command: Actions.PRESTIGE, delay: FIFTEEN_SECONDS_MS },
];

export const ShoppingPlan: CommandPlan = [
  { command: Actions.SHOP_FERTILIZER, delay: FIFTEEN_SECONDS_MS },
  { command: Actions.SHOP_CDR, delay: FIFTEEN_SECONDS_MS },
];

export const FarmPlan: CommandPlan = [
  { command: Actions.STEAL, delay: FIFTEEN_SECONDS_MS },
  { command: Actions.FARM, delay: FIFTEEN_SECONDS_MS },
  { command: Actions.TRAMPLE, delay: FIFTEEN_SECONDS_MS },
  { command: Actions.CDR, delay: FIFTEEN_SECONDS_MS },
];
