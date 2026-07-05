import { BEARER_TOKEN, API_URL, BOT_PREFIX } from "./utils/config.js";
import { Actions } from "./plans.js";

export interface CommandResult {
  text: string | null;
  isError: boolean;
}

const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

function isRetryable(error: unknown): boolean {
  if (error instanceof TypeError || error instanceof DOMException) return true;
  return error instanceof Error && /^HTTP (408|429|5\d\d)$/.test(error.message);
}

function retryDelay(attempt: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, RETRY_BASE_DELAY_MS * 2 ** attempt));
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
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: `${BOT_PREFIX}${command}` }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as ApiResponse;
      if (data.statusCode !== 200) {
        throw new Error(data.errors?.map((e) => e.message).join("; ") ?? "Unknown error");
      }

      const [resp] = Array.isArray(data.data) ? data.data : [data.data];
      if (!resp) return { text: null, isError: false };
      if (resp.error !== undefined) return { text: resp.error, isError: true };
      return { text: resp.text ?? null, isError: false };
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS - 1 || !isRetryable(error)) throw error;
      await retryDelay(attempt);
    }
  }
}

export async function fetchRank(): Promise<string | null> {
  try {
    const { text } = await sendCommand(Actions.RANK);
    return text;
  } catch {
    return null;
  }
}
