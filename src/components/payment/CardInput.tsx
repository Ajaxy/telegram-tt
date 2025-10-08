import type { FC } from '../../lib/teact/teact';
import {
  memo, useCallback, useEffect,
  useRef, useState,
} from '../../lib/teact/teact';

import { requestMeasure } from '../../lib/fasterdom/fasterdom';
import { IS_TOUCH_ENV } from '../../util/browser/windowEnvironment';
import focusNoScroll from '../../util/focusNoScroll';
import { CardType, detectCardType } from '../common/helpers/detectCardType';
import { formatCardNumber } from '../middle/helpers/inputFormatters';

import useOldLang from '../../hooks/useOldLang';

import InputText from '../ui/InputText';

import './CardInput.scss';

import mastercardIconPath from '../../assets/mastercard.svg';
import mirIconPath from '../../assets/mir.svg';
import visaIconPath from '../../assets/visa.svg';

const CARD_NUMBER_MAX_LENGTH = 19;

export type OwnProps = {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  isActive?: boolean;
};

const CardInput: FC<OwnProps> = ({ value, error, onChange, isActive }) => {
  const lang = useOldLang();
  const cardNumberRef = useRef<HTMLInputElement>();

  useEffect(() => {
    if (!isActive || IS_TOUCH_ENV) {
      return;
    }

    requestMeasure(() => {
      focusNoScroll(cardNumberRef.current);
    });
  }, [isActive]);

  const [cardType, setCardType] = useState<number>(CardType.Default);
  useEffect(() => {
    const newCardType = detectCardType(value);
    setCardType(newCardType);
  // eslint-disable-next-line
  }, []);

  const handleChange = useCallback((e) => {
    const newValue = formatCardNumber(e.target.value);
    const newCardType = detectCardType(e.target.value);
    setCardType(newCardType);
    onChange(newValue);
  }, [onChange]);

  const cardIcon = getCardIcon(cardType);

  return (
    <div className="CardInput">
      <InputText
        ref={cardNumberRef}
        label={lang('PaymentCardNumber')}
        onChange={handleChange}
        value={value}
        inputMode="numeric"
        className={cardType ? 'has-right-addon' : ''}
        error={error}
        tabIndex={0}
        maxLength={CARD_NUMBER_MAX_LENGTH}
        teactExperimentControlled
      />
      <span className="right-addon">{cardIcon}</span>
    </div>
  );
};

export default memo(CardInput);

function getCardIcon(cardType: CardType) {
  switch (cardType) {
    case CardType.Mastercard:
      return <img src={mastercardIconPath} draggable={false} alt="" />;
    case CardType.Visa:
      return <img src={visaIconPath} draggable={false} alt="" />;
    case CardType.Mir:
      return <img src={mirIconPath} draggable={false} alt="" />;
    default:
      return undefined;
  }
}
