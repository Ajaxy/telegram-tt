export type WishSettings = {
  shouldShowWish: boolean;
  shouldShowSupporters: boolean;
  shouldShowAmounts: boolean;
};

export type WishSupporter = {
  userId: string;
  // Decimal with at most two fraction digits
  amountGram: number;
  // Unix time in seconds
  lastSupportAt: number;
};

export type Wish = {
  id: string;
  ownerId: string;
  title: string;
  targetGram: number;
  raisedGram: number;
  settings: WishSettings;
  supporters: WishSupporter[];
};

export type WishUpdate = {
  title?: string;
  targetGram?: number;
  settings?: Partial<WishSettings>;
};
