import * as wishApi from '../../../api/wish/mockWishApi';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateWish, updateWishDemoBalance } from '../../reducers';
import { selectCanHaveWish, selectWish } from '../../selectors';

addActionHandler('loadWish', async (global, actions, payload): Promise<void> => {
  const { ownerId } = payload;
  if (!selectCanHaveWish(global, ownerId)) return;

  const [wish, demoBalanceGram] = await Promise.all([
    wishApi.fetchWish({ ownerId }),
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
