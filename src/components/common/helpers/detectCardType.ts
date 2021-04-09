const VISA = /^4[0-9]{12}(?:[0-9]{1,3})?$/;
const MASTERCARD1 = /^5[1-5][0-9]{11,14}$/;
const MASTERCARD2 = /^2[2-7][0-9]{11,14}$/;

export enum CardType {
  Default,
  Visa,
  Mastercard,
}

const cards: Record<number, string> = {
  [CardType.Default]: '',
  [CardType.Visa]: 'visa',
  [CardType.Mastercard]: 'mastercard',
};

export function detectCardType(cardNumber: string): number {
  cardNumber = cardNumber.replace(/\s/g, '');
  if (VISA.test(cardNumber)) {
    return CardType.Visa;
  }
  if (MASTERCARD1.test(cardNumber) || MASTERCARD2.test(cardNumber)) {
    return CardType.Mastercard;
  }
  return CardType.Default;
}

export function detectCardTypeText(cardNumber: string): string {
  const cardType = detectCardType(cardNumber);
  return cards[cardType as number] || '';
}
