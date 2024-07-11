export function getShortWalletAddress(walletAddress: string) {
  if (!walletAddress) {
    return '';
  }

  return `${walletAddress.substring(0, 4)}...${walletAddress.slice(-4)}`;
}
