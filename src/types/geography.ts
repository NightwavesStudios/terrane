export interface Peak {
  id?: string;
  slug: string;
  name: string;
  elevationM: number;
  elevationFt?: number;
  prominenceM?: number;
  prominenceFt?: number;
  location?: string;
  range?: string;
  description?: string;
  lat?: number;
  lon?: number;
  isHighpoint?: boolean;
  rank?: number;
  listIds?: string[];
  sourceUrl?: string;
  osmUrl?: string;
}
