import { GlobalState } from '../types';
import { InlineBotSettings } from '../../types';

export function replaceInlineBotSettings(
  global: GlobalState, username: string, inlineBotSettings: InlineBotSettings | false,
): GlobalState {
  return {
    ...global,
    inlineBots: {
      ...global.inlineBots,
      byUsername: {
        ...global.inlineBots.byUsername,
        [username]: inlineBotSettings,
      },
    },
  };
}

export function replaceInlineBotsIsLoading(global: GlobalState, isLoading: boolean): GlobalState {
  return {
    ...global,
    inlineBots: {
      ...global.inlineBots,
      isLoading,
    },
  };
}
