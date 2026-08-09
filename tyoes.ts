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




// src/types/user/registration.ts
export interface RegistrationData {
  email: string;
  password: string;
  surname: string;
  othernames: string;
  phone?: string;
}

export interface RegistrationResponse {
  message: string;
  user?: {
    id: number;
    email: string;
    surname: string;
    othernames: string;
  };
}

export interface RegistrationError {
  detail?: string;
  email?: string[];      // e.g. ["This email is already registered"]
  password?: string[];   // e.g. ["Password is too short"]
}




// src/types/user/login.ts
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  // No csrf_token here — it's now in httpOnly cookie (Double Submit Cookie)
}

export interface LoginError {
  detail: string;
  // You can add more specific error fields if your backend returns them
}

