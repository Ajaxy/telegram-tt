import { GlobalState } from '../../global/types';

export function updateTwoFaSettings(
  global: GlobalState,
  update: GlobalState['twoFaSettings'],
): GlobalState {
  return {
    ...global,
    twoFaSettings: {
      ...global.twoFaSettings,
      ...update,
    },
  };
}
