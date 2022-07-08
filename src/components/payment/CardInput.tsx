import type { FC } from '../../lib/teact/teact';
import React, {
  memo, useCallback, useState, useRef, useEffect,
} from '../../lib/teact/teact';

import { formatCardNumber } from '../middle/helpers/inputFormatters';
import { detectCardType, CardType } from '../common/helpers/detectCardType';
import useFocusAfterAnimation from '../../hooks/useFocusAfterAnimation';
import useLang from '../../hooks/useLang';

import InputText from '../ui/InputText';

import './CardInput.scss';

import mastercardIconPath from '../../assets/mastercard.svg';
import visaIconPath from '../../assets/visa.svg';

const CARD_NUMBER_MAX_LENGTH = 23;

export type OwnProps = {
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

const CardInput : FC<OwnProps> = ({ value, error, onChange }) => {
  const lang = useLang();
  // eslint-disable-next-line no-null/no-null
  const cardNumberRef = useRef<HTMLInputElement>(null);

  useFocusAfterAnimation(cardNumberRef);

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
      return <img src={mastercardIconPath} alt="" />;
    case CardType.Visa:
      return <img src={visaIconPath} alt="" />;
    default:
      return undefined;
  }
}
