declare module TEST {
  export interface Abc {
    text?: string;
    detect?: string[]|boolean;
    fallback?: string;
		minLength?: number;
		minScore?: number;
		distance?: number;
  }

  export interface Fingerprint {
    rank: number;
    iso: string;
    name: string;
    trigrams: Object;
  }
}

export = TEST;
