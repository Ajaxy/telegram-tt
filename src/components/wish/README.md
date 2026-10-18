# Wish — a Gram fundraising goal on Telegram profiles

A concept for the "Designers × AI" contest, built inside Telegram Web A.

A user can attach one **wish** to their profile, such as "Trip to Tokyo, 120 / 500 GRAM". Visitors see a faceted crystal that fills up as the wish is supported. Owners decide what visitors can see.

> **Demo data only.** Balances, supporters and transfers come from an in-memory mock (`src/api/wish/mockWishApi.ts`). No real Grams are ever sent, and the recipient address is made up.

## How to run

1. `cp .env.example .env` (on Windows: `copy`). Then fill in `TELEGRAM_API_ID` and `TELEGRAM_API_HASH` from [my.telegram.org](https://my.telegram.org).
2. `npm i`
3. `npm run dev`, then open http://localhost:1234 and log in.

Where to see it:

- **Owner view**: open Settings (or *My Profile*). A wish row sits under the username, with **Manage wish** below it.
- **Visitor view**: open the profile of anyone in a private chat. Every regular user gets a demo wish. Tap **Support this wish**.

The demo supporters are fictional people (`src/api/wish/demoPeople.ts`) with generated illustrated avatars, so no real accounts show up in the demo. The only real person in the list is the sender, after they support a wish. Easter egg: Dmitriy.

## What's in it

| Piece | Behavior |
| --- | --- |
| Profile row | Title, `120 / 500 GRAM`, a facepile of the 3 latest supporters, the count and the crystal. The action row reads *Support this wish* for visitors and *Manage wish* for the owner. |
| Crystal | A 2D canvas gem with an octagonal table, 8-sided girdle and culet: 25 facets sorted back to front, a key light plus a rim light. The fill is a liquid with a gentle wavy surface that rises with progress and turns from blue to gold at 100%. It also has a soft glow that fades out inside the canvas, plus sparkles. It spins on its own, and dragging rotates it with inertia (pitch is clamped). It pauses while off screen. |
| Gestures | Only a touch that starts on the gem's silhouette rotates it. A hit layer clipped with `clip-path` has `touch-action: none`; the rest of the row scrolls the page as usual. |
| Details modal | Progress bar, `X of Y GRAM · P% · N supporters`, and a supporters list with Recent/Top tabs. Owners also get the *Visible to visitors* toggles (wish, supporters, amounts) and *Edit title and target*. |
| Visibility | With supporters hidden, visitors see a note and no facepile. With amounts hidden, they see `•••`. With the wish hidden, visitors don't see it at all and the owner sees it dimmed. |
| Support flow | A demo *Send Grams* screen built from the wallet's own styles and parts (`WalletSendScreen.module.scss`, `WalletRecentRecipient`, `ExpandableTonAmount`, `GramIcon`). It adds a *For wish: …* chip, a demo balance, *Max*, *Insufficient funds*, and the fiat estimate. |
| Success | Both modals close and **the page does not scroll**. `min(14, ceil(amount) + 3)` diamonds fly from the bottom of the viewport along quadratic Bézier curves to the crystal's *current* position, which is re-measured every frame. They are staggered by 70 ms, each flight takes 900 ms with smoothstep easing, and they draw on a fixed `pointer-events: none` canvas. Each arrival adds `amount / n`, flashes the crystal and vibrates (when supported). The first arrival adds the sender to the supporters. |
| Motion | With `prefers-reduced-motion`, the crystal doesn't auto-rotate, the waves and sparkles are off, there are no particles, and values update instantly. |

## Architecture

- **Data**: `Wish` type in `src/types/wish.ts`. The service is `src/api/wish/mockWishApi.ts` (`fetchWish`, `updateWish`, `supportWish`, `fetchDemoBalance`), async like a real API. To make it real, swap in implementations that call the backend. To pay with the real wallet, `supportWish` would open `openWalletModal({ initialRecipient, initialAmount })` instead.
- **State**: `global.wishes` (not cached), plus `loadWish` / `updateWish` / `supportWish` actions in `src/global/actions/api/wish.ts`. Tab state holds `wishModal`, `wishSendModal` and `wishBurst`, with UI actions in `src/global/actions/ui/wish.ts`.
- **UI**: everything new lives in `src/components/wish/`. The modals are wrapped modals on `@gili/modal`, lazy-loaded through the Extra bundle.

### Existing files touched (hook-in only)

- `src/components/common/profile/ChatExtra.tsx`: renders `<WishRow />` under the usernames (+2 lines).
- `src/components/modals/ModalContainer.tsx`: registers the two modals.
- `src/bundles/extra.ts`: lazy exports.
- `src/global/actions/all.ts`, `src/global/selectors/index.ts`, `src/global/reducers/index.ts`: module registration.
- `src/global/types/{globalState,tabState,actions}.ts`: state and action types.
- `src/assets/localization/fallback.strings` + generated `src/types/language.d.ts`: new `Wish*` strings.

No new dependencies. Auth, network and wallet code are untouched.

## Verified

- Light and dark themes, desktop width and 390×844: profile row, crystal, details modal, send screen and particles.
- The page keeps its scroll position through the whole send flow (all scroll containers checked before and after).
- Owner toggles immediately change what visitors see.
- Leaving the profile mid-flight still applies the support and clears the overlay.
- `tsc`, ESLint and Stylelint pass.

Not verified on a real device: touch scrolling around the crystal (checked with hit testing and computed `touch-action`) and `prefers-reduced-motion`, which was checked in code only because the browser used here can't emulate it.
