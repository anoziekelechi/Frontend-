
export interface CountryCreate {
  name: string;
  currency_code: string;
  whatsapp: string;
}

export interface CreateCountryResponse {
  message: string;
  country: {
    id: number;
    name: string;
    currency_code: string;
    whatsapp: string;
  };
}


//types/country/update.ts

export interface CountryUpdate {
  name?: string;
  currency_code?: string;
  whatsapp?: string;
}


//=types country read.ts

export interface CountryRead {
  id: number;
  name: string;
  currency_code: string;
  whatsapp: string;
  created_at: string;
  updated_at: string;
}



//types list


import type { CountryRead } from "./read";

export interface CountryListRead {
  total: number;
  items: CountryRead[];
}




//country types index.ts


export * from "./create";
export * from "./update";
export * from "./read";
export * from "./list";


//types index.ts

export * from "./user";
export * from "./country";
export * from "./product";
export * from "./common";




