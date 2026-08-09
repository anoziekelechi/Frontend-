// src/types/user/profile.ts
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




// src/types/user/index.ts
export * from "./profile";
export * from "./registration";
export * from "./login";
export * from "./common";



// src/types/index.ts
export * from "./user";
export * from "./product";
export * from "./common";




