type MiddleFooterParams = {
  isMobile?: boolean;
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
};

function getHasMobileFooterButton({
  isMobile, canSubscribe, shouldJoinToSend, shouldSendJoinRequest,
  canStartBot, canRestartBot, canUnblock,
}: MiddleFooterParams) {
  return Boolean(isMobile) && Boolean(
    canSubscribe || shouldJoinToSend || shouldSendJoinRequest || canStartBot || canRestartBot || canUnblock,
  );
}

export default function getHasMiddleFooter(params: MiddleFooterParams) {
  const {
    canPost, withExtraShift, isPinnedMessageList, canUnpin, canShowOpenChatButton,
  } = params;

  return Boolean(
    canPost || withExtraShift || (isPinnedMessageList && canUnpin) || canShowOpenChatButton
    || getHasMobileFooterButton(params),
  );
}
