type MiddleFooterParams = {
  canPost?: boolean;
  withExtraShift?: boolean;
  isPinnedMessageList?: boolean;
  canUnpin?: boolean;
  canShowOpenChatButton?: boolean;
  canSubscribe?: boolean;
  shouldJoinToSend?: boolean;
  shouldSendJoinRequest?: boolean;
  canStartBot?: boolean;
  canRestartBot?: boolean;
  canUnblock?: boolean;
  isChannelMuteBar?: boolean;
};

export function getHasFooterActionBar({
  canSubscribe, shouldJoinToSend, shouldSendJoinRequest,
  canStartBot, canRestartBot, canUnblock, isChannelMuteBar,
  isPinnedMessageList, canUnpin, canShowOpenChatButton,
}: MiddleFooterParams) {
  return Boolean(
    canSubscribe || shouldJoinToSend || shouldSendJoinRequest
    || canStartBot || canRestartBot || canUnblock || isChannelMuteBar
    || (isPinnedMessageList && canUnpin) || canShowOpenChatButton,
  );
}

export default function getHasMiddleFooter(params: MiddleFooterParams) {
  const { canPost, withExtraShift } = params;

  return Boolean(
    canPost || withExtraShift || getHasFooterActionBar(params),
  );
}
