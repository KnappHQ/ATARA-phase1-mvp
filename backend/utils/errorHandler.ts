export class ErrorHandler extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  /** A short, fixed diagnostic code the app can show, e.g. "MP-SECRET-PREFIX". Never a value. */
  public readonly code?: string;

  constructor(message: string, statusCode: number, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}
