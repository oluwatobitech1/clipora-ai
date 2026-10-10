import type { ErrorCode } from "@clipora/shared";

/** An error whose message is safe to send to the browser. */
export class ApiError extends Error {
  status: number;
  code: ErrorCode;
  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
