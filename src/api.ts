import { BEARER_TOKEN, API_URL, BOT_PREFIX } from "./config.js";
import { formatLogText, log } from "./logger.js";
import { Actions } from "./plans.js";

export interface CommandResult {
  text: string | null;
  isError: boolean;
}

export class CommandError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CommandError";
    this.status = status;
  }
}

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

function isRetryable(error: unknown): boolean {
  if (
    error instanceof TypeError ||
    (error instanceof Error &&
      (error.name === "AbortError" || error.name === "TimeoutError"))
  )
    return true;
  if (error instanceof CommandError)
    return error.status === 408 || error.status === 429 || error.status >= 500;
  return error instanceof Error && /^HTTP (408|429|5\d\d)$/.test(error.message);
}

function retryDelay(attempt: number): Promise<void> {
  return new Promise((resolve) =>
    setTimeout(resolve, RETRY_BASE_DELAY_MS * 2 ** attempt),
  );
}

interface ApiResponseData {
  text?: string;
  error?: string;
}

interface ApiResponse {
  data: ApiResponseData[] | ApiResponseData;
  errors?: { message: string }[];
  statusCode: number;
}

export async function sendCommand(command: string): Promise<CommandResult> {
  for (let attempt = 0; ; attempt += 1) {
    const startedAt = Date.now();
    try {
      log.debug("Sending command", { command, attempt: attempt + 1 });
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: `${BOT_PREFIX}${command}` }),
        signal: AbortSignal.timeout(10_000),
      });

      const data = (await response.json()) as ApiResponse;
      if (!response.ok || data.statusCode !== 200) {
        throw new CommandError(
          data.errors?.map((e) => e.message).join("; ") ??
            `HTTP ${response.status}`,
          data.statusCode || response.status,
        );
      }

      const [resp] = Array.isArray(data.data) ? data.data : [data.data];
      const result = !resp
        ? { text: null, isError: false }
        : resp.error !== undefined
          ? { text: resp.error, isError: true }
          : { text: resp.text ?? null, isError: false };
      log.debug("Command completed", {
        command,
        attempt: attempt + 1,
        durationMs: Date.now() - startedAt,
        isError: result.isError,
        response: formatLogText(result.text),
      });
      return result;
    } catch (error) {
      const retrying = attempt < MAX_ATTEMPTS - 1 && isRetryable(error);
      if (retrying) {
        log.warn("Command attempt failed; retrying", {
          command,
          attempt: attempt + 1,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
        await retryDelay(attempt);
        continue;
      }

      if (error instanceof CommandError) {
        log.warn("Command was rejected", {
          command,
          status: error.status,
          durationMs: Date.now() - startedAt,
          error: error.message,
        });
      } else {
        log.error("Command request failed", error, {
          command,
          durationMs: Date.now() - startedAt,
        });
      }
      throw error;
    }
  }
}

export async function fetchRank(): Promise<string | null> {
  try {
    const { text } = await sendCommand(Actions.RANK);
    return text;
  } catch (err) {
    log.warn("Unable to refresh rank", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
