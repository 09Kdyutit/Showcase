export type EntitlementErrorCode =
  | 'SESSION_LIMIT_REACHED'
  | 'AUDIO_LIMIT_REACHED'
  | 'RETRY_LIMIT_REACHED'
  | 'SESSION_TYPE_REQUIRES_PRO'
  | 'DIFFICULTY_REQUIRES_PRO'
  | 'COACHING_MODE_REQUIRES_PRO'
  | 'QUESTION_COUNT_EXCEEDS_PLAN'
  | 'GLOBAL_BUDGET_REACHED'
  | 'CONCURRENT_SESSION_LIMIT'

export class EntitlementError extends Error {
  code: EntitlementErrorCode
  httpStatus: number
  constructor(code: EntitlementErrorCode, message: string, httpStatus = 403) {
    super(message)
    this.code = code
    this.httpStatus = httpStatus
  }
}
