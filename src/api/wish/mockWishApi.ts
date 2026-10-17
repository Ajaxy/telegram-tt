import type { Wish, WishUpdate } from '../../types/wish';

import { getDemoPeopleIds } from './demoPeople';

// In-memory stand-in for a wish backend with the same async surface a real API would have.
// No wallet transfer happens here: balances and amounts are demo values.

const DEMO_BALANCE_GRAM = 48;
const DEMO_TITLES = ['Trip to Tokyo', 'New camera', 'Guitar lessons', 'Mountain bike', 'Coffee machine'];
const DEMO_TARGETS_GRAM = [500, 300, 250, 400, 150];
const DEMO_SUPPORT_AMOUNTS_GRAM = [15, 40, 20, 30, 10, 5];
// Minutes ago, matching the prototype's "1h ago" / "yesterday" / "3d ago" spread
const DEMO_SUPPORT_AGES_MIN = [60, 180, 1700, 2900, 4400, 7300];
const SECONDS_IN_MINUTE = 60;
const GRAM_FRACTION_FACTOR = 100;

const wishesByOwnerId = new Map<string, Wish>();
let demoBalanceGram = DEMO_BALANCE_GRAM;

export function fetchWish({ ownerId }: { ownerId: string }) {
  let wish = wishesByOwnerId.get(ownerId);
  if (!wish) {
    wish = buildDemoWish(ownerId);
    wishesByOwnerId.set(ownerId, wish);
  }

  return Promise.resolve(wish);
}

export function updateWish({ ownerId, update }: { ownerId: string; update: WishUpdate }) {
  const wish = wishesByOwnerId.get(ownerId);
  if (!wish) return Promise.resolve(undefined);

  const newWish: Wish = {
    ...wish,
    title: update.title ?? wish.title,
    targetGram: update.targetGram !== undefined ? roundGram(update.targetGram) : wish.targetGram,
    settings: { ...wish.settings, ...update.settings },
  };
  wishesByOwnerId.set(ownerId, newWish);

  return Promise.resolve(newWish);
}

export function supportWish({ ownerId, supporterId, amountGram }: {
  ownerId: string;
  supporterId: string;
  amountGram: number;
}) {
  const wish = wishesByOwnerId.get(ownerId);
  const amount = roundGram(amountGram);
  if (!wish || amount <= 0 || amount > demoBalanceGram) return Promise.resolve(undefined);

  const now = Math.floor(Date.now() / 1000);
  const current = wish.supporters.find(({ userId }) => userId === supporterId);
  const otherSupporters = wish.supporters.filter(({ userId }) => userId !== supporterId);
  const newWish: Wish = {
    ...wish,
    raisedGram: roundGram(wish.raisedGram + amount),
    supporters: [
      { userId: supporterId, amountGram: roundGram((current?.amountGram ?? 0) + amount), lastSupportAt: now },
      ...otherSupporters,
    ],
  };
  wishesByOwnerId.set(ownerId, newWish);
  demoBalanceGram = roundGram(demoBalanceGram - amount);

  return Promise.resolve({ wish: newWish, balanceGram: demoBalanceGram });
}

export function fetchDemoBalance() {
  return Promise.resolve(demoBalanceGram);
}

export function roundGram(value: number) {
  return Math.round(value * GRAM_FRACTION_FACTOR) / GRAM_FRACTION_FACTOR;
}

function buildDemoWish(ownerId: string): Wish {
  const seed = getIdSeed(ownerId);
  const now = Math.floor(Date.now() / 1000);
  const supporters = getDemoPeopleIds().slice(0, DEMO_SUPPORT_AMOUNTS_GRAM.length).map((userId, i) => ({
    userId,
    amountGram: DEMO_SUPPORT_AMOUNTS_GRAM[i],
    lastSupportAt: now - DEMO_SUPPORT_AGES_MIN[i] * SECONDS_IN_MINUTE,
  }));

  return {
    id: `wish-${ownerId}`,
    ownerId,
    title: DEMO_TITLES[seed % DEMO_TITLES.length],
    targetGram: DEMO_TARGETS_GRAM[seed % DEMO_TARGETS_GRAM.length],
    raisedGram: roundGram(supporters.reduce((sum, { amountGram }) => sum + amountGram, 0)),
    settings: { shouldShowWish: true, shouldShowSupporters: true, shouldShowAmounts: true },
    supporters,
  };
}

function getIdSeed(id: string) {
  return Array.from(id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
}
