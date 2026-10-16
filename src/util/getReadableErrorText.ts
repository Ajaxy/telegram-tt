import type { ApiError, ApiFieldError } from '../api/types';
import type { RegularLangKey } from '../types/language';
import type { LangFn } from './localization';

import { DEBUG } from '../config';

const READABLE_ERROR_KEYS: Record<string, RegularLangKey> = {
  CHAT_RESTRICTED: 'ErrorChatRestricted',
  CHAT_SEND_POLL_FORBIDDEN: 'ErrorChatSendPollForbidden',
  CHAT_SEND_STICKERS_FORBIDDEN: 'ErrorChatSendStickersForbidden',
  CHAT_SEND_GIFS_FORBIDDEN: 'ErrorChatSendGifsForbidden',
  CHAT_SEND_MEDIA_FORBIDDEN: 'ErrorChatSendMediaForbidden',
  CHAT_LINK_EXISTS: 'ErrorChatLinkExists',
  SLOWMODE_WAIT_X: 'ErrorSlowmodeWaitX',
  USER_BANNED_IN_CHANNEL: 'ErrorUserBannedInChannel',
  USER_IS_BLOCKED: 'ErrorUserIsBlocked',
  YOU_BLOCKED_USER: 'ErrorYouBlockedUser',
  IMAGE_PROCESS_FAILED: 'ErrorImageProcessFailed',
  MEDIA_EMPTY: 'ErrorMediaEmpty',
  MEDIA_GROUPED_INVALID: 'ErrorMediaGroupedInvalid',
  MEDIA_NEW_INVALID: 'ErrorMediaNewInvalid',
  MESSAGE_NOT_MODIFIED: 'ErrorMessageNotModified',
  MEDIA_INVALID: 'ErrorMediaInvalid',
  PASSWORD_HASH_INVALID: 'ErrorIncorrectPassword',
  PHOTO_EXT_INVALID: 'ErrorPhotoExtInvalid',
  PHOTO_INVALID_DIMENSIONS: 'ErrorPhotoInvalidDimensions',
  PHOTO_SAVE_FILE_INVALID: 'ErrorPhotoSaveFileInvalid',
  MESSAGE_DELETE_FORBIDDEN: 'ErrorMessageDeleteForbidden',
  MESSAGE_POLL_CLOSED: 'ErrorMessagePollClosed',
  MESSAGE_EDIT_TIME_EXPIRED: 'ErrorMessageEditTimeExpired',
  PINNED_DIALOGS_TOO_MUCH: 'ErrorPinnedDialogsTooMuch',
  CHANNEL_PRIVATE: 'ErrorChannelPrivate',
  MEDIA_CAPTION_TOO_LONG: 'ErrorMediaCaptionTooLong',
  ADDRESS_STREET_LINE1_INVALID: 'ErrorAddressStreetInvalid',
  ADDRESS_STREET_LINE2_INVALID: 'ErrorAddressStreetInvalid',
  ADDRESS_CITY_INVALID: 'ErrorAddressCityInvalid',
  ADDRESS_COUNTRY_INVALID: 'ErrorAddressCountryInvalid',
  ADDRESS_POSTCODE_INVALID: 'ErrorAddressPostcodeInvalid',
  ADDRESS_STATE_INVALID: 'ErrorAddressStateInvalid',
  REQ_INFO_NAME_INVALID: 'ErrorReqInfoNameInvalid',
  REQ_INFO_PHONE_INVALID: 'ErrorReqInfoPhoneInvalid',
  REQ_INFO_EMAIL_INVALID: 'ErrorReqInfoEmailInvalid',
  LINK_NOT_MODIFIED: 'ErrorLinkNotModified',
  MESSAGE_TOO_LONG: 'ErrorMessageTooLongText',
  SERVICE_WORKER_DISABLED: 'ErrorServiceWorkerDisabled',
  FRESH_RESET_AUTHORISATION_FORBIDDEN: 'ErrorFreshSessionLogout',
  BOTS_TOO_MUCH: 'ErrorBotsTooMuch',
  BOT_GROUPS_BLOCKED: 'ErrorBotGroupsBlocked',
  USERS_TOO_MUCH: 'ErrorUsersTooMuch',
  USER_CHANNELS_TOO_MUCH: 'ErrorUserChannelsTooMuch',
  USER_KICKED: 'ErrorUserKicked',
  USER_NOT_MUTUAL_CONTACT: 'ErrorUserNotMutualContact',
  USER_PRIVACY_RESTRICTED: 'ErrorUserPrivacyRestricted',
  INVITE_HASH_EMPTY: 'ErrorInviteHashEmpty',
  INVITE_HASH_EXPIRED: 'ErrorInviteHashExpired',
  INVITE_HASH_INVALID: 'ErrorInviteHashInvalid',
  CHANNELS_TOO_MUCH: 'ErrorChannelsTooMuch',
  USER_ALREADY_PARTICIPANT: 'ErrorUserAlreadyParticipant',
  SCHEDULE_DATE_INVALID: 'ErrorScheduleDateInvalid',
  WALLPAPER_DIMENSIONS_INVALID: 'ErrorWallpaperDimensionsInvalid',
  ADMINS_TOO_MUCH: 'ErrorAdminsTooMuch',
  ADMIN_RANK_EMOJI_NOT_ALLOWED: 'ErrorAdminRankEmojiNotAllowed',
  ADMIN_RANK_INVALID: 'ErrorAdminRankInvalid',
  FRESH_CHANGE_ADMINS_FORBIDDEN: 'ErrorFreshAdmin',
  SESSION_TOO_FRESH: 'ErrorSessionTooFresh',
  SESSION_IS_FRESH: 'ErrorSessionTooFresh',
  INPUT_USER_DEACTIVATED: 'ErrorInputUserDeactivated',
  BOT_PRECHECKOUT_TIMEOUT: 'ErrorBotPrecheckoutTimeout',
  PROVIDER_ACCOUNT_TIMEOUT: 'ErrorProviderAccountTimeout',
  STARGIFT_CONVERT_TOO_OLD: 'ErrorStargiftConvertTooOld',
  SUBSCRIPTION_ALREADY_ACTIVE: 'ErrorSubscriptionAlreadyActive',
  PEERS_LIST_EMPTY: 'ErrorPeersListEmpty',
  PAID_MEDIA_FORBIDDEN: 'ErrorPaidMediaForbidden',
  USER_DISALLOWED_STARGIFTS: 'SendDisallowError',
};

if (DEBUG) {
  READABLE_ERROR_KEYS.CHAT_WRITE_FORBIDDEN = 'ErrorChatWriteForbidden';
  READABLE_ERROR_KEYS.CHAT_ADMIN_REQUIRED = 'ErrorChatAdminRequired';
}

export const SHIPPING_ERRORS: Record<string, ApiFieldError> = {
  ADDRESS_STREET_LINE1_INVALID: {
    field: 'streetLine1',
    messageKey: { key: 'PaymentIncorrectStreet' },
  },
  ADDRESS_STREET_LINE2_INVALID: {
    field: 'streetLine2',
    messageKey: { key: 'PaymentIncorrectStreet' },
  },
  ADDRESS_CITY_INVALID: {
    field: 'city',
    messageKey: { key: 'PaymentIncorrectCity' },
  },
  ADDRESS_COUNTRY_INVALID: {
    field: 'countryIso2',
    messageKey: { key: 'PaymentIncorrectCountry' },
  },
  ADDRESS_POSTCODE_INVALID: {
    field: 'postCode',
    messageKey: { key: 'PaymentIncorrectPostCode' },
  },
  ADDRESS_STATE_INVALID: {
    field: 'state',
    messageKey: { key: 'PaymentIncorrectState' },
  },
  REQ_INFO_NAME_INVALID: {
    field: 'fullName',
    messageKey: { key: 'PaymentIncorrectName' },
  },
  REQ_INFO_PHONE_INVALID: {
    field: 'phone',
    messageKey: { key: 'PaymentIncorrectPhone' },
  },
  REQ_INFO_EMAIL_INVALID: {
    field: 'email',
    messageKey: { key: 'PaymentIncorrectEmail' },
  },
};

const FINAL_PAYMENT_ERRORS = new Set([
  'BOT_PRECHECKOUT_FAILED',
  'PAYMENT_FAILED',
]);

const ERROR_CODES_WITHOUT_DIALOG = new Set([
  406,
]);

export default function getReadableErrorText(lang: LangFn, error: ApiError) {
  const { message, isSlowMode, textParams } = error;
  // The server supplies the remaining wait time in the slow-mode message
  if (isSlowMode) {
    const extraPartIndex = message.indexOf(' (caused by');
    return extraPartIndex > 0 ? message.substring(0, extraPartIndex) : message;
  }
  if (message === 'MESSAGE_TOO_LONG_PLEASE_REMOVE_CHARACTERS') {
    const count = Number(textParams?.['{EXTRA_CHARS_COUNT}'] ?? textParams?.EXTRA_CHARS_COUNT);
    return Number.isFinite(count) && count >= 0
      ? lang('ErrorMessageTooLong', { count }, { pluralValue: count })
      : lang('ErrorMessageTooLongText');
  }
  const key = READABLE_ERROR_KEYS[message];
  return key ? lang(key) : undefined;
}

export function getShippingError(error: ApiError): ApiFieldError | undefined {
  return SHIPPING_ERRORS[error.message];
}

export function shouldClosePaymentModal(error: ApiError): boolean {
  return FINAL_PAYMENT_ERRORS.has(error.message);
}

export function shouldShowErrorDialog(error: ApiError): boolean {
  if (error.code && ERROR_CODES_WITHOUT_DIALOG.has(error.code)) return false;
  if (error.hasErrorKey && !error.isSlowMode && !READABLE_ERROR_KEYS[error.message]
    && error.message !== 'MESSAGE_TOO_LONG_PLEASE_REMOVE_CHARACTERS') return false;

  return true;
}
