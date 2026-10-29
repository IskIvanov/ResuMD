/**
 * errors.ts
 *
 * The error the Reactive Resume client throws when a request gets no response
 * at all. A response with a non-2xx status is the client's RxResumeApiError.
 */

import { ReasonedError } from "../utils/error.ts";
import { EnvVar } from "./config.ts";
import {
  ErrorMessages,
  RxResumeErrorCode,
  type RxResumeErrorReason,
} from "./types.ts";

/**
 * Words a reason as the message the user sees. The switch has no default, so
 * a new code that isn't worded here fails to compile.
 */
function describeRxResumeError(reason: RxResumeErrorReason): string {
  switch (reason.code) {
    case RxResumeErrorCode.Unreachable:
      return (
        `${reason.method} ${reason.url} ${ErrorMessages.Failed} ${reason.detail}\n` +
        `Check ${EnvVar.BaseUrl} ${ErrorMessages.CheckApiUrl}`
      );
  }
}

/**
 * A request that never got a response, typed by its reason. The network error
 * stays on `cause`.
 *
 * @example
 * throw new RxResumeError(
 *   { code: RxResumeErrorCode.Unreachable, method, url, detail },
 *   { cause: error },
 * );
 * // POST https://localhost:3000/api/openapi/resumes failed: ConnectionRefused: …
 */
export class RxResumeError<
  TReason extends RxResumeErrorReason = RxResumeErrorReason,
> extends ReasonedError<TReason> {
  constructor(reason: TReason, options?: ErrorOptions) {
    super(reason, describeRxResumeError(reason), options);
  }
}
