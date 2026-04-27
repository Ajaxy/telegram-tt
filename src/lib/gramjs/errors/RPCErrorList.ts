import {
  BadRequestError, FloodError, InvalidDCError, RPCError, TimedOutError,
} from './RPCBaseErrors';

export class UserMigrateError extends InvalidDCError {
  public newDc: number;

  constructor(args: any) {
    const newDc = Number(args.capture || 0);
    super(args.errorMessage, args.request, args.code);
    this.newDc = newDc;
  }
}

export class PhoneMigrateError extends InvalidDCError {
  public newDc: number;

  constructor(args: any) {
    const newDc = Number(args.capture || 0);
    super(args.errorMessage, args.request, args.code);
    this.newDc = newDc;
  }
}

export class SlowModeWaitError extends FloodError {
  public seconds: number;

  constructor(args: any) {
    const seconds = Number(args.capture || 0);
    super(args.errorMessage, args.request, args.code);
    this.seconds = seconds;
  }
}

export class FloodWaitError extends FloodError {
  public seconds: number;

  constructor(args: any) {
    const seconds = Number(args.capture || 0);
    super(args.errorMessage, args.request, args.code);
    this.seconds = seconds;
  }
}

export class FloodPremiumWaitError extends FloodWaitError {
  constructor(args: any) {
    const seconds = Number(args.capture || 0);
    super(args);
    this.seconds = seconds;
  }
}

export class MsgWaitError extends FloodError {
  constructor(args: any) {
    super(args.errorMessage, args.request, args.code);
  }
}

export class FloodTestPhoneWaitError extends FloodError {
  public seconds: number;

  constructor(args: any) {
    const seconds = Number(args.capture || 0);
    super(args.errorMessage, args.request, args.code);
    this.seconds = seconds;
  }
}

export class FileMigrateError extends InvalidDCError {
  public newDc: number;

  constructor(args: any) {
    const newDc = Number(args.capture || 0);
    super(args.errorMessage, args.request, args.code);
    this.newDc = newDc;
  }
}

export class NetworkMigrateError extends InvalidDCError {
  public newDc: number;

  constructor(args: any) {
    const newDc = Number(args.capture || 0);
    super(args.errorMessage, args.request, args.code);
    this.newDc = newDc;
  }
}

export class EmailUnconfirmedError extends BadRequestError {
  codeLength: number;

  constructor(args: any) {
    const codeLength = Number(args.capture || 0);
    super(args.errorMessage, args.request, args.code);
    this.codeLength = codeLength;
  }
}

export class PasswordFreshError extends BadRequestError {
  public seconds: number;

  constructor(args: any) {
    const seconds = Number(args.capture || 0);
    super(args.errorMessage, args.request, args.code);
    this.seconds = seconds;
  }
}

export class SessionFreshError extends BadRequestError {
  public seconds: number;

  constructor(args: any) {
    const seconds = Number(args.capture || 0);
    super(args.errorMessage, args.request, args.code);
    this.seconds = seconds;
  }
}

export class PasskeyLoginRequestedError extends Error {
  public credentialJson: AuthenticationResponseJSON;

  constructor(credentialJson: AuthenticationResponseJSON) {
    super('Passkey login requested');
    this.message = 'RESTART_AUTH_WITH_PASSKEY';
    this.credentialJson = credentialJson;
  }
}

export class UserAlreadyAuthorizedError extends Error {
  public userId: string;
  constructor(userId: string) {
    super('User already authorized');
    this.message = 'USER_ALREADY_AUTHORIZED';
    this.userId = userId;
  }
}

export class PasskeyCredentialNotFoundError extends RPCError {
  constructor(args: any) {
    super(args.errorMessage, args.request, args.code);
  }
}

export const rpcErrorRe = new Map<RegExp, any>([
  [/FILE_MIGRATE_(\d+)/, FileMigrateError],
  [/FLOOD_TEST_PHONE_WAIT_(\d+)/, FloodTestPhoneWaitError],
  [/FLOOD_WAIT_(\d+)/, FloodWaitError],
  [/FLOOD_PREMIUM_WAIT_(\d+)/, FloodPremiumWaitError],
  [/MSG_WAIT_(.*)/, MsgWaitError],
  [/PHONE_MIGRATE_(\d+)/, PhoneMigrateError],
  [/SLOWMODE_WAIT_(\d+)/, SlowModeWaitError],
  [/USER_MIGRATE_(\d+)/, UserMigrateError],
  [/NETWORK_MIGRATE_(\d+)/, NetworkMigrateError],
  [/EMAIL_UNCONFIRMED_(\d+)/, EmailUnconfirmedError],
  [/PASSWORD_TOO_FRESH_(\d+)/, PasswordFreshError],
  [/SESSION_TOO_FRESH_(\d+)/, SessionFreshError],
  [/^Timeout$/, TimedOutError],
  [/PASSKEY_CREDENTIAL_NOT_FOUND/, PasskeyCredentialNotFoundError],
]);
