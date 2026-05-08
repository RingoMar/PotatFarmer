import "dotenv/config";

import { sendCommand, fetchRank } from "./api.js";
import { BOT_PREFIX } from "./utils/config.js";
import { MINUTE_MS } from "./utils/constants.js";
import { logger } from "./utils/logger.js";
import { sleep } from "./utils/sleep.js";
import {
  Actions,
  LevelsPlan,
  ShoppingPlan,
  FarmPlan,
  shouldRun,
  type CommandPlan,
} from "./plans.js";
import {
  displayStats,
  playerInfo,
  recordCommandResult,
  setLastCommand,
  updateFromRank,
} from "./stats.js";

async function refreshRank(): Promise<void> {
  const text = await fetchRank();
  if (text) updateFromRank(text);
}

async function runPlan(plan: CommandPlan): Promise<void> {
  for (const step of plan) {
    if (!shouldRun(step.command, playerInfo)) {
      await sleep(step.delay);
      continue;
    }
    try {
      const result = await sendCommand(step.command);
      if (result.text !== null) setLastCommand(`${BOT_PREFIX}${step.command}`);
      recordCommandResult(step.command, result.text, result.isError);

      // Prestige zeros your balance — re-fetch immediately so the cdr gate
      // isn't still looking at the old count.
      if (
        step.command === Actions.PRESTIGE &&
        !result.isError &&
        result.text !== null
      ) {
        await refreshRank();
      }
    } catch (err) {
      logger.error(`Command "${step.command}": ${String(err)}`);
    }
    await sleep(step.delay);
  }
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
