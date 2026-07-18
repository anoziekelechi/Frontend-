// src/types/user.ts
export interface User {
  id: number;
  email: string;
  surname: string;
  othernames: string;
  phone?: string | null;
  verified: boolean;
  disabled: boolean;
  date_added: string;
}

// src/types/index.ts
export * from "./user";
export * from "./product";
export * from "./auth";
