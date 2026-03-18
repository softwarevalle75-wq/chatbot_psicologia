/**
 * Errores de aplicación tipados.
 * Permite al errorHandler distinguir entre errores de negocio
 * (que tienen un statusCode propio) y errores inesperados (500).
 */

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Recurso no encontrado") {
    super(message, 404);
    this.name = "NotFoundError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "No autorizado") {
    super(message, 401);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acceso denegado") {
    super(message, 403);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflicto con un recurso existente") {
    super(message, 409);
    this.name = "ConflictError";
  }
}
