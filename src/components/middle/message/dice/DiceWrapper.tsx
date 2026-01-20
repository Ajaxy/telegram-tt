import { memo } from '../../../../lib/teact/teact';

import type { ApiDice } from '../../../../api/types';
import type { ObserveFn } from '../../../../hooks/useIntersectionObserver';

import { SLOT_MACHINE_EMOJI } from '../../../../config';

import Dice from './Dice';
import SlotMachine from './SlotMachine';

export type OwnProps = {
  dice: ApiDice;
  canPlayWinEffect?: boolean;
  isLocal?: boolean;
  isOutgoing?: boolean;
  onEffectPlayed?: NoneToVoidFunction;
  observeIntersectionForLoading?: ObserveFn;
  observeIntersectionForPlaying?: ObserveFn;
};

const DiceWrapper = (props: OwnProps) => {
  if (props.dice.emoticon === SLOT_MACHINE_EMOJI) {
    return <SlotMachine {...props} />;
  }

  return <Dice {...props} />;
};

export default memo(DiceWrapper);
