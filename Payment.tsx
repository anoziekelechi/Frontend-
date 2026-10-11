
// src/types/payment/read.ts

export interface PaymentMethodRead {
  id: number;
  country_id: number;
  name: string;
  slug?: string | null;
  created_at: string;
  updated_at: string;
}

/** Payment methods for a single country. */
export interface CountryPaymentMethodsRead {
  country_id: number;
  country_name: string;
  payment_methods: PaymentMethodRead[];
}

/** All payment methods, grouped by country. */
export interface AllPaymentMethodsRead {
  total_countries: number;
  data: CountryPaymentMethodsRead[];
}




// src/types/payment/create.ts

import type { PaymentMethodRead } from "./read";

export interface PaymentMethodCreate {
  country_id: number;
  name: string;
}

export interface CreatePaymentMethodResponse {
  message: string;
  payment_method: PaymentMethodRead;
}


// src/types/payment/update.ts

import type { PaymentMethodRead } from "./read";

export interface PaymentMethodUpdate {
  name?: string;
}

export interface UpdatePaymentMethodResponse {
  message: string;
  payment_method: PaymentMethodRead;
}




// src/types/payment/index.ts

export * from "./read";
export * from "./create";
export * from "./update";



// src/types/index.ts

export * from "./common";
export * from "./user";
export * from "./country";
export * from "./payment";
export * from "./firm";
export * from "./receipt";
export * from "./site";







// src/pages/payment-methods/CreatePaymentMethod.tsx


    
