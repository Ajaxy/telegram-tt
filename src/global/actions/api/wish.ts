import { isUserId } from '../../../util/entities/ids';
import * as wishApi from '../../../api/wish/mockWishApi';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateWish, updateWishDemoBalance } from '../../reducers';
import { selectCanHaveWish, selectWish } from '../../selectors';

const DEMO_SUPPORTERS_LIMIT = 6;

addActionHandler('loadWish', async (global, actions, payload): Promise<void> => {
  const { ownerId } = payload;
  if (!selectCanHaveWish(global, ownerId)) return;

  const supporterIds = (global.chats.listIds.active ?? []).filter((id) => (
    isUserId(id) && id !== ownerId && id !== global.currentUserId && selectCanHaveWish(global, id)
  )).slice(0, DEMO_SUPPORTERS_LIMIT);

  const [wish, demoBalanceGram] = await Promise.all([
    wishApi.fetchWish({ ownerId, supporterIds }),
    wishApi.fetchDemoBalance(),
  ]);

  global = getGlobal();
  global = updateWish(global, wish);
  global = updateWishDemoBalance(global, demoBalanceGram);
  setGlobal(global);
});

addActionHandler('updateWish', async (global, actions, payload): Promise<void> => {
  const { ownerId, update } = payload;
  if (ownerId !== global.currentUserId) return;

  const wish = await wishApi.updateWish({ ownerId, update });
  if (!wish) return;

  global = getGlobal();
  global = updateWish(global, wish);
  setGlobal(global);
});

addActionHandler('supportWish', async (global, actions, payload): Promise<void> => {
  const { ownerId, amountGram } = payload;
  const supporterId = global.currentUserId;
  if (!supporterId || supporterId === ownerId || !selectWish(global, ownerId)) return;

  const result = await wishApi.supportWish({ ownerId, supporterId, amountGram });
  if (!result) return;

  global = getGlobal();
  global = updateWish(global, result.wish);
  global = updateWishDemoBalance(global, result.balanceGram);
  setGlobal(global);
});
