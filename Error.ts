// src/types.ts
export interface UserCreateData { ... }

export interface ValidationError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export interface PydanticError {
  detail: ValidationError[];
}

// Used here for 409
export interface CustomError {
  detail: string;
}
