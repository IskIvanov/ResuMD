/**
 * errors.ts
 *
 * The one error the cover-letter flows throw for a failure of their own.
 * Callers pass a CoverLetterErrorReason, never a message; an API rejection
 * is passed on as the client's RxResumeApiError.
 */

import { ReasonedError } from "../utils/error.ts";
import {
  CoverLetterErrorCode,
  CoverLetterLabel,
  type CoverLetterErrorReason,
} from "./types.ts";

/**
 * Words a reason as the message the user sees. The switch has no default, so
 * a new code that isn't worded here fails to compile.
 */
function describeCoverLetterError(reason: CoverLetterErrorReason): string {
  switch (reason.code) {
    case CoverLetterErrorCode.NotFreeform:
      return `${CoverLetterLabel.CoverLetter} ${reason.id} ${CoverLetterLabel.IsLaidOut} "${reason.layout}"; ${CoverLetterLabel.OnlyFreeform}`;
    case CoverLetterErrorCode.LeftInTrash:
      return `${reason.failure}; ${CoverLetterLabel.Letter} ${reason.id} ${CoverLetterLabel.InTrash}`;
  }
}

/**
 * A cover-letter failure, typed by its reason.
 *
 * @example
 * throw new CoverLetterError({ code: CoverLetterErrorCode.NotFreeform, id, layout });
 * // Cover letter clx… is laid out "structured"; only a freeform letter can be updated, …
 */
export class CoverLetterError<
  TReason extends CoverLetterErrorReason = CoverLetterErrorReason,
> extends ReasonedError<TReason> {
  constructor(reason: TReason, options?: ErrorOptions) {
    super(reason, describeCoverLetterError(reason), options);
  }
}
