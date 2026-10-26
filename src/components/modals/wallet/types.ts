export enum WalletScreen {
  Main,
  Receive,
  Buy,
  BuyAmount,
  Currency,
  Send,
  SendAmount,
  Transaction,
  Collectible,
  PhraseInfo,
  Phrase,
  EnterPhrase,
  Password,
  Passcode,
  DisableBackup,
  ReleaseKey,
  Settings,
  DeleteWallet,
  ReplaceWallet,
  PasscodeRequired,
  TonConnect,
  ConnectedApps,
  ConnectedApp,
  Intro,
}

export type PasswordIntent = 'phrase' | 'send' | 'decrypt' | 'enableBackup' | 'disableBackup' | 'replace'
  | 'tonConnect';

export type WalletTransferPayload = {
  toAddress: string;
  toUserId?: string;
  // Nanotons
  amount: bigint;
  comment?: string;
  shouldEncryptComment?: boolean;
  shouldSendAll?: boolean;
  collectibleAddress?: string;
  // The relayer was to pay the fee
  isGasless?: boolean;
  isAnimated?: boolean;
};

export type WalletSendDraft = {
  // A wallet swapped in meanwhile must not send the draft
  fromAddress?: string;
  collectibleAddress?: string;
  recipient: string;
  // The text of the recipient field: a user picked from the list leaves it as typed, so Back shows the same list
  recipientQuery: string;
  // The user chosen as the recipient, valid while `recipient` is still their address
  recipientUser?: { id: string; address: string };
  amount: string;
  comment: string;
  isCommentPublic: boolean;
};

export const EMPTY_SEND_DRAFT: WalletSendDraft = {
  recipient: '', recipientQuery: '', amount: '', comment: '', isCommentPublic: false,
};
