export enum WalletScreen {
  Main,
  Receive,
  Buy,
  BuyAmount,
  Currency,
  Send,
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
  HowItWorks,
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
