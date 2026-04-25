import "dotenv/config";

import { sendCommand, fetchRank } from "./api.js";
import { BOT_PREFIX } from "./utils/config.js";
import { MINUTE_MS } from "./utils/constants.js";
import { logger } from "./utils/logger.js";
import { sleep } from "./utils/sleep.js";
import {
  LevelsPlan,
  ShoppingPlan,
  FarmPlan,
  type CommandPlan,
} from "./plans.js";
import {
  displayStats,
  recordCommandResult,
  setLastCommand,
  updateFromRank,
} from "./stats.js";

async function runPlan(plan: CommandPlan): Promise<void> {
  for (const { command, delay } of plan) {
    try {
      const result = await sendCommand(command);
      if (result.text !== null) setLastCommand(`${BOT_PREFIX}${command}`);
      recordCommandResult(command, result.text, result.isError);
    } catch (err) {
      logger.error(`Command "${command}": ${String(err)}`);
    }
    await sleep(delay);
  }
}

async function refreshRank(): Promise<void> {
  const text = await fetchRank();
  if (text) updateFromRank(text);
}

async function runDisplay(): Promise<never> {
  for (;;) {
    try {
      displayStats();
    } catch (err) {
      logger.error(`Display error: ${String(err)}`);
    }
    await sleep(1000);
  }
}

async function run(): Promise<never> {
  await refreshRank();
  for (;;) {
    await runPlan(LevelsPlan);
    await runPlan(ShoppingPlan);
    await runPlan(FarmPlan);
    await refreshRank();
    await sleep(MINUTE_MS);
  }
}

await Promise.all([run(), runDisplay()]);
