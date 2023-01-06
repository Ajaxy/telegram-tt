import {
  MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN,
  MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN,
  MOBILE_SCREEN_MAX_WIDTH,
} from '../../../config';
import { REM } from '../../common/helpers/mediaDimensions';

const MAX_TOOLBAR_WIDTH = 32 * REM;
const MAX_MESSAGES_LIST_WIDTH = 45.5 * REM;
export const SIDE_COLUMN_MAX_WIDTH = 26.5 * REM;
export const MIN_LEFT_COLUMN_WIDTH = 16 * REM;
const UNPIN_BUTTON_WIDTH = 16.125 * REM;

export default function calculateMiddleFooterTransforms(windowWidth: number, canPost?: boolean) {
  const sidePadding = windowWidth <= MOBILE_SCREEN_MAX_WIDTH
    ? REM
    : 2 * REM;
  const messageListWidth = getMessageListWidth(windowWidth);
  const sendButtonWidth = windowWidth <= MOBILE_SCREEN_MAX_WIDTH
    ? 3.375 * REM
    : 4 * REM;

  const composerWidth = canPost
    ? messageListWidth - sidePadding - sendButtonWidth
    : messageListWidth - sidePadding;
  const toolbarWidth = windowWidth > MOBILE_SCREEN_MAX_WIDTH
    ? Math.min(messageListWidth - sidePadding, MAX_TOOLBAR_WIDTH)
    : messageListWidth - sidePadding;

  const composerHiddenScale = toolbarWidth / composerWidth;
  const toolbarHiddenScale = composerWidth / toolbarWidth;
  const unpinHiddenScale = toolbarWidth / UNPIN_BUTTON_WIDTH;
  const toolbarForUnpinHiddenScale = UNPIN_BUTTON_WIDTH / toolbarWidth;

  const composerTranslateX = canPost
    ? (sendButtonWidth / 2) * toolbarHiddenScale
    : 0;

  const toolbarTranslateX = canPost
    ? (sendButtonWidth / 2) * -1 * composerHiddenScale
    : 0;

  return {
    composerHiddenScale,
    toolbarHiddenScale,
    composerTranslateX,
    toolbarTranslateX,
    unpinHiddenScale,
    toolbarForUnpinHiddenScale,
  };
}

function getMessageListWidth(windowWidth: number) {
  if (windowWidth > MIN_SCREEN_WIDTH_FOR_STATIC_RIGHT_COLUMN) {
    const leftColumnWidth = Math.min(
      Math.max(windowWidth * 0.25, MIN_LEFT_COLUMN_WIDTH),
      SIDE_COLUMN_MAX_WIDTH,
    );

    const rightColumnWidth = Math.min(
      windowWidth * 0.25,
      SIDE_COLUMN_MAX_WIDTH,
    );

    return Math.min(
      windowWidth - leftColumnWidth - rightColumnWidth,
      MAX_MESSAGES_LIST_WIDTH,
    );
  }

  if (windowWidth > MIN_SCREEN_WIDTH_FOR_STATIC_LEFT_COLUMN) {
    const leftColumnWidth = Math.min(
      Math.max(windowWidth * 0.4, MIN_LEFT_COLUMN_WIDTH),
      SIDE_COLUMN_MAX_WIDTH,
    );

    return Math.min(
      windowWidth - leftColumnWidth,
      MAX_MESSAGES_LIST_WIDTH,
    );
  }

  if (windowWidth > MAX_MESSAGES_LIST_WIDTH) {
    return MAX_MESSAGES_LIST_WIDTH;
  }

  return windowWidth;
}
