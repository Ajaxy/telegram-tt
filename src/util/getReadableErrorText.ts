import type { ApiError, ApiFieldError } from '../api/types';

import { DEBUG } from '../config';

const READABLE_ERROR_MESSAGES: Record<string, string> = {
  CHAT_RESTRICTED: 'You can\'t send messages in this chat, you were restricted',
  CHAT_SEND_POLL_FORBIDDEN: 'You can\'t create polls in this chat',
  CHAT_SEND_STICKERS_FORBIDDEN: 'You can\'t send stickers in this chat',
  CHAT_SEND_GIFS_FORBIDDEN: 'You can\'t send gifs in this chat',
  CHAT_SEND_MEDIA_FORBIDDEN: 'You can\'t send media in this chat',
  CHAT_LINK_EXISTS: 'The chat is public, you can\'t hide the history to new users',
  // eslint-disable-next-line max-len
  SLOWMODE_WAIT_X: 'Slowmode is enabled in this chat: you must wait for the specified number of seconds before sending another message to the chat.',
  USER_BANNED_IN_CHANNEL: 'You\'re banned from sending messages in supergroups / channels',
  USER_IS_BLOCKED: 'You were blocked by this user',
  YOU_BLOCKED_USER: 'You blocked this user',
  IMAGE_PROCESS_FAILED: 'Failure while processing image',
  MEDIA_EMPTY: 'The provided media object is invalid',
  MEDIA_GROUPED_INVALID: 'Failed to replace album media',
  MEDIA_NEW_INVALID: 'Failed to replace new media',
  MESSAGE_NOT_MODIFIED: 'Message not modified. The new content is identical to the current one.',
  MEDIA_INVALID: 'Media invalid',
  PHOTO_EXT_INVALID: 'The extension of the photo is invalid',
  PHOTO_INVALID_DIMENSIONS: 'The photo dimensions are invalid',
  PHOTO_SAVE_FILE_INVALID: 'Internal issues, try again later',
  // eslint-disable-next-line max-len
  MESSAGE_DELETE_FORBIDDEN: 'You can\'t delete one of the messages you tried to delete, most likely because it is a service message.',
  MESSAGE_POLL_CLOSED: 'Poll closed',
  MESSAGE_EDIT_TIME_EXPIRED: 'You can\'t edit this message anymore.',
  PINNED_DIALOGS_TOO_MUCH: 'Sorry, you can only pin 5 chats to the top',
  CHANNEL_PRIVATE: 'This channel is private',
  MEDIA_CAPTION_TOO_LONG: 'The provided caption is too long',
  ADDRESS_STREET_LINE1_INVALID: 'The address you provided is not valid',
  ADDRESS_STREET_LINE2_INVALID: 'The address you provided is not valid',
  ADDRESS_CITY_INVALID: 'The city you provided is not valid',
  ADDRESS_COUNTRY_INVALID: 'The country you provided is not valid',
  ADDRESS_POSTCODE_INVALID: 'The postcode you provided is not valid',
  ADDRESS_STATE_INVALID: 'The state you provided is not valid',
  REQ_INFO_NAME_INVALID: 'The name you provided is not valid',
  REQ_INFO_PHONE_INVALID: 'The phone you provided is not valid',
  REQ_INFO_EMAIL_INVALID: 'The email you provided is not valid',
  // TODO Bring back after fixing the weird bug
  // CHANNEL_INVALID: 'An error occurred. Please try again later',
  LINK_NOT_MODIFIED: 'This discussion is already linked to the channel',
  MESSAGE_TOO_LONG: 'Message is too long',

  // Non-API errors
  // eslint-disable-next-line max-len
  SERVICE_WORKER_DISABLED: 'Service Worker is disabled. Streaming media may not be supported. Try reloading the page without holding <Shift> key',
  // eslint-disable-next-line max-len
  MESSAGE_TOO_LONG_PLEASE_REMOVE_CHARACTERS: 'The provided message is too long. Please remove {EXTRA_CHARS_COUNT} character{PLURAL_S}.',
  // eslint-disable-next-line max-len
  FRESH_RESET_AUTHORISATION_FORBIDDEN: 'You can’t logout other sessions if less than 24 hours have passed since you logged on the current session',

  BOTS_TOO_MUCH: 'There are too many bots in this chat/channel',
  BOT_GROUPS_BLOCKED: 'This bot can\'t be added to groups',
  USERS_TOO_MUCH: 'The maximum number of users has been exceeded',
  USER_CHANNELS_TOO_MUCH: 'One of the users you tried to add is already in too many channels/supergroups',
  USER_KICKED: 'This user was kicked from this supergroup/channel',
  USER_NOT_MUTUAL_CONTACT: 'The provided user is not a mutual contact',
  USER_PRIVACY_RESTRICTED: 'The user\'s privacy settings do not allow you to do this',
  INVITE_HASH_EMPTY: 'The invite hash is empty',
  INVITE_HASH_EXPIRED: 'The invite link has expired',
  INVITE_HASH_INVALID: 'The invite hash is invalid',
  CHANNELS_TOO_MUCH: 'You have joined too many channels/supergroups',
  USER_ALREADY_PARTICIPANT: 'You already in the group',
  SCHEDULE_DATE_INVALID: 'Invalid schedule date provided',
  WALLPAPER_DIMENSIONS_INVALID: 'The wallpaper dimensions are invalid, please select another file',
  ADMINS_TOO_MUCH: 'There are too many admins',
  ADMIN_RANK_EMOJI_NOT_ALLOWED: 'An admin rank cannot contain emojis',
  ADMIN_RANK_INVALID: 'The specified admin rank is invalid',
  FRESH_CHANGE_ADMINS_FORBIDDEN: 'You were just elected admin, you can\'t add or modify other admins yet',
  INPUT_USER_DEACTIVATED: 'The specified user was deleted',
  BOT_PRECHECKOUT_TIMEOUT: 'The request for payment has expired',

  PEERS_LIST_EMPTY: 'No chats are added to the list',
};

if (DEBUG) {
  READABLE_ERROR_MESSAGES.CHAT_WRITE_FORBIDDEN = 'You can\'t write in this chat';
  READABLE_ERROR_MESSAGES.CHAT_ADMIN_REQUIRED = 'You must be an admin in this chat to do this';
}

export const SHIPPING_ERRORS: Record<string, ApiFieldError> = {
  ADDRESS_STREET_LINE1_INVALID: {
    field: 'streetLine1',
    message: 'Incorrect street address',
  },
  ADDRESS_STREET_LINE2_INVALID: {
    field: 'streetLine2',
    message: 'Incorrect street address',
  },
  ADDRESS_CITY_INVALID: {
    field: 'city',
    message: 'Incorrect city',
  },
  ADDRESS_COUNTRY_INVALID: {
    field: 'countryIso2',
    message: 'Incorrect country',
  },
  ADDRESS_POSTCODE_INVALID: {
    field: 'postCode',
    message: 'Incorrect post code',
  },
  ADDRESS_STATE_INVALID: {
    field: 'state',
    message: 'Incorrect state',
  },
  REQ_INFO_NAME_INVALID: {
    field: 'fullName',
    message: 'Incorrect name',
  },
  REQ_INFO_PHONE_INVALID: {
    field: 'phone',
    message: 'Incorrect phone',
  },
  REQ_INFO_EMAIL_INVALID: {
    field: 'email',
    message: 'Incorrect email',
  },
};

const FINAL_PAYMENT_ERRORS = new Set([
  'BOT_PRECHECKOUT_FAILED',
  'PAYMENT_FAILED',
]);

export default function getReadableErrorText(error: ApiError) {
  const { message, isSlowMode, textParams } = error;
  // Currently, Telegram API doesn't return `SLOWMODE_WAIT_X` error as described in the docs
  if (isSlowMode) {
    const extraPartIndex = message.indexOf(' (caused by');
    return extraPartIndex > 0 ? message.substring(0, extraPartIndex) : message;
  }
  let errorMessage = READABLE_ERROR_MESSAGES[message];
  if (errorMessage && textParams) {
    errorMessage = Object.keys(textParams).reduce((acc, current) => {
      return acc.replace(current, textParams[current]);
    }, errorMessage as string);
  }
  return errorMessage;
}

export function getShippingError(error: ApiError): ApiFieldError | undefined {
  return SHIPPING_ERRORS[error.message];
}

export function shouldClosePaymentModal(error: ApiError): boolean {
  return FINAL_PAYMENT_ERRORS.has(error.message);
}
