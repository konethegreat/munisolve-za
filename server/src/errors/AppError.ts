export interface FieldError {
  field: string;
  message: string;
}

export class AppError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly details?: FieldError[];
  readonly expose: boolean;

  constructor(statusCode: number, errorCode: string, message: string, details?: FieldError[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.expose = statusCode < 500;
  }
}
