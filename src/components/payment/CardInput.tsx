import React, {
  FC, memo, useCallback, useState, useRef, useEffect,
} from '../../lib/teact/teact';

import useFocusAfterAnimation from '../../hooks/useFocusAfterAnimation';
import { formatCardNumber } from '../middle/helpers/inputFormatters';
import { detectCardType, CardType } from '../common/helpers/detectCardType';

import InputText from '../ui/InputText';

import './CardInput.scss';

// @ts-ignore
import mastercardIconPath from '../../assets/mastercard.svg';
// @ts-ignore
import visaIconPath from '../../assets/visa.svg';

const CARD_NUMBER_MAX_LENGTH = 23;

export type OwnProps = {
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

const CardInput : FC<OwnProps> = ({ value, error, onChange }) => {
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
    if (cardNumberRef.current) {
      cardNumberRef.current.value = newValue;
    }
  }, [onChange, cardNumberRef]);

  const cardIcon = getCardIcon(cardType);

  return (
    <div className="CardInput">
      <span className="left-addon">{cardIcon}</span>
      <InputText
        ref={cardNumberRef}
        label="Card number"
        onChange={handleChange}
        value={value}
        inputMode="numeric"
        className={cardType ? 'has-left-addon' : ''}
        error={error}
        maxLength={CARD_NUMBER_MAX_LENGTH}
      />
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
