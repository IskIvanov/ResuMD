/**
 * errors.ts
 *
 * The one error the Reactive Resume platform throws for a failure of its own,
 * including a request that gets no response at all. Callers pass an
 * RxResumeErrorReason, never a message; a response with a non-2xx status is
 * passed on as the client's RxResumeApiError.
 */

import { ReasonedError } from "../utils/error.ts";
import {
  EnvVar,
  ErrorMessages,
  RxResumeErrorCode,
  type RxResumeErrorReason,
} from "./types.ts";

enum ErrorLabel {
  Missing = "Missing",
  CopyEnvFile = "Copy .env.example to .env and fill it in.",
  Check = "Check",
  CoverLetter = "Cover letter",
  IsLaidOut = "is laid out",
  OnlyFreeform = "only a freeform letter can be updated, since the .md writes its own greeting and sign-off",
  Letter = "letter",
  InTrash = "is in Trash",
}

const LIST_SEPARATOR = ", ";

/**
 * Words a reason as the message the user sees. The switch has no default, so
 * a new code that isn't worded here fails to compile.
 */
function describeRxResumeError(reason: RxResumeErrorReason): string {
  switch (reason.code) {
    case RxResumeErrorCode.MissingSettings:
      return `${ErrorLabel.Missing} ${reason.missing.join(LIST_SEPARATOR)}. ${ErrorLabel.CopyEnvFile}`;
    case RxResumeErrorCode.Unreachable:
      return (
        `${reason.method} ${reason.url} ${ErrorMessages.Failed} ${reason.detail}\n` +
        `${ErrorLabel.Check} ${EnvVar.BaseUrl} ${ErrorMessages.CheckApiUrl}`
      );
    case RxResumeErrorCode.NotFreeform:
      return `${ErrorLabel.CoverLetter} ${reason.id} ${ErrorLabel.IsLaidOut} "${reason.layout}"; ${ErrorLabel.OnlyFreeform}`;
    case RxResumeErrorCode.LeftInTrash:
      return `${reason.failure}; ${ErrorLabel.Letter} ${reason.id} ${ErrorLabel.InTrash}`;
  }
}

/**
 * A Reactive Resume failure, typed by its reason. A network error stays on
 * `cause`.
 *
 * @example
 * throw new RxResumeError({ code: RxResumeErrorCode.NotFreeform, id, layout });
 * // Cover letter clx… is laid out "structured"; only a freeform letter can be updated, …
 */
export class RxResumeError<
  TReason extends RxResumeErrorReason = RxResumeErrorReason,
> extends ReasonedError<TReason> {
  constructor(reason: TReason, options?: ErrorOptions) {
    super(reason, describeRxResumeError(reason), options);
  }
}
