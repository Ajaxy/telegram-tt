/* eslint-disable max-len */

import type { ApiLangPack } from '../api/types';

export const fallbackLangPackInitial = {
  WrongNumber: {
    key: 'WrongNumber',
    value: 'Wrong number?',
  },
  SentAppCode: {
    key: 'SentAppCode',
    value: 'We\'ve sent the code to the **Telegram** app on your other device.',
  },
  'Login.JustSentSms': {
    key: 'Login.JustSentSms',
    value: 'We have sent you a code via SMS. Please enter it above.',
  },
  'Login.Header.Password': {
    key: 'Login.Header.Password',
    value: 'Enter Password',
  },
  'Login.EnterPasswordDescription': {
    key: 'Login.EnterPasswordDescription',
    value: 'You have Two-Step Verification enabled, so your account is protected with an additional password.',
  },
  StartText: {
    key: 'StartText',
    value: 'Please confirm your country code and enter your phone number.',
  },
  'Login.PhonePlaceholder': {
    key: 'Login.PhonePlaceholder',
    value: 'Your phone number',
  },
  'Login.Next': {
    key: 'Login.Next',
    value: 'Next',
  },
  'Login.QR.Login': {
    key: 'Login.QR.Login',
    value: 'Log in by QR Code',
  },
  'Login.QR.Title': {
    key: 'Login.QR.Title',
    value: 'Log in to Telegram by QR Code',
  },
  'Login.QR.Help1': {
    key: 'Login.QR.Help1',
    value: 'Open Telegram on your phone',
  },
  'Login.QR.Help2': {
    key: 'Login.QR.Help2',
    value: 'Go to **Settings** > **Devices** > **Link Desktop Device**',
  },
  'Login.QR2.Help2': {
    key: 'Login.QR.Help2',
    value: 'Go to **Settings** → **Devices** → **Link Desktop Device**',
  },
  'Login.QR.Help3': {
    key: 'Login.QR.Help3',
    value: 'Point your phone at this screen to confirm login',
  },
  'Login.QR.Cancel': {
    key: 'Login.QR.Cancel',
    value: 'Log in by phone Number',
  },
  YourName: {
    key: 'YourName',
    value: 'Your Name',
  },
  'Login.Register.Desc': {
    key: 'Login.Register.Desc',
    value: 'Enter your name and add a profile picture.',
  },
  'Login.Register.FirstName.Placeholder': {
    key: 'Login.Register.FirstName.Placeholder',
    value: 'First Name',
  },
  'Login.Register.LastName.Placeholder': {
    key: 'Login.Register.LastName.Placeholder',
    value: 'Last Name',
  },
  'Login.SelectCountry.Title': {
    key: 'Login.SelectCountry.Title',
    value: 'Country',
  },
  lng_country_none: {
    key: 'lng_country_none',
    value: 'Country not found',
  },
  PleaseEnterPassword: {
    key: 'PleaseEnterPassword',
    value: 'Enter your new password',
  },
  PHONE_NUMBER_INVALID: {
    key: 'PHONE_NUMBER_INVALID',
    value: 'Invalid phone number',
  },
  PHONE_CODE_INVALID: {
    key: 'PHONE_CODE_INVALID',
    value: 'Invalid code',
  },
  PASSWORD_HASH_INVALID: {
    key: 'PASSWORD_HASH_INVALID',
    value: 'Incorrect password',
  },
  PHONE_PASSWORD_FLOOD: {
    key: 'PHONE_PASSWORD_FLOOD',
    value: 'Limit exceeded. Please try again later.',
  },
  PHONE_NUMBER_BANNED: {
    key: 'PHONE_NUMBER_BANNED',
    value: 'This phone number is banned.',
  },
} as ApiLangPack;
