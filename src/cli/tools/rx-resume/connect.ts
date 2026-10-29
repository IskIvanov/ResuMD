/**
 * connect.ts
 *
 * Connects a Reactive Resume tool to the real world: the global `fetch`,
 * random ids, the local date and stderr for RXRESUME_DEBUG's request log. Kept here so the tool files only say what
 * they do.
 */

import { randomUUID } from "crypto";
import { DateTime } from "luxon";
import {
  connectRxResume,
  type RxResume,
  STDERR_REQUEST_LOG,
} from "../../../rx-resume/index.ts";
import type { Env } from "../../../utils/types.ts";

/** Today's date in the local time zone, as `YYYY-MM-DD`. */
function localToday(): string {
  return DateTime.now().toISODate();
}

/**
 * Connects to the Reactive Resume API that `env` configures.
 *
 * @param env - The environment holding the `.env` settings.
 * @returns The platform's operations.
 * @throws If a setting is missing, naming each one.
 *
 * @example
 * await connect(env).resumes.delete(id);
 */
export function connect(env: Env): RxResume {
  return connectRxResume({
    env,
    fetch: globalThis.fetch,
    newId: randomUUID,
    today: localToday,
    requestLog: STDERR_REQUEST_LOG,
  });
}
