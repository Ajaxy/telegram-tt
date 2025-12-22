/* eslint-disable @stylistic/max-len */
import {
  BadRequestError, FloodError, InvalidDCError, RPCError, TimedOutError,
} from './RPCBaseErrors';

export class UserMigrateError extends InvalidDCError {
  public newDc: number;

  constructor(args: any) {
    const newDc = Number(args.capture || 0);
    super(`The user whose identity is being used to execute queries is associated with DC ${newDc}${RPCError._fmtRequest(args.request)}`, args.request);
    this.message = `The user whose identity is being used to execute queries is associated with DC ${newDc}${RPCError._fmtRequest(args.request)}`;
    this.newDc = newDc;
  }
}

export class PhoneMigrateError extends InvalidDCError {
  public newDc: number;

  constructor(args: any) {
    const newDc = Number(args.capture || 0);
    super(`The phone number a user is trying to use for authorization is associated with DC ${newDc}${RPCError._fmtRequest(args.request)}`, args.request);
    this.message = `The phone number a user is trying to use for authorization is associated with DC ${newDc}${RPCError._fmtRequest(args.request)}`;
    this.newDc = newDc;
  }
}

export class SlowModeWaitError extends FloodError {
  public seconds: number;

  constructor(args: any) {
    const seconds = Number(args.capture || 0);
    super(
      `A wait of ${seconds} seconds is required before sending another message in this chat ${RPCError._fmtRequest(args.request)}`,
      args.request,
    );
    this.message = `A wait of ${seconds} seconds is required before sending another message in this chat${RPCError._fmtRequest(args.request)}`;
    this.seconds = seconds;
  }
}

export class FloodWaitError extends FloodError {
  public seconds: number;

  constructor(args: any) {
    const seconds = Number(args.capture || 0);
    super(
      `A wait of ${seconds} seconds is required${RPCError._fmtRequest(args.request)}`,
      args.request,
    );
    this.message = `A wait of ${seconds} seconds is required${RPCError._fmtRequest(args.request)}`;
    this.seconds = seconds;
  }
}

export class FloodPremiumWaitError extends FloodWaitError {
  constructor(args: any) {
    const seconds = Number(args.capture || 0);
    super(`A wait of ${seconds} seconds is required${RPCError._fmtRequest(args.request)}`);
    this.message = `A wait of ${seconds} seconds is required${RPCError._fmtRequest(args.request)}`;
    this.seconds = seconds;
  }
}

export class MsgWaitError extends FloodError {
  constructor(args: any) {
    super(
      `Message failed to be sent.${RPCError._fmtRequest(args.request)}`,
      args.request,
    );
    this.message = `Message failed to be sent.${RPCError._fmtRequest(
      args.request,
    )}`;
  }
}

export class FloodTestPhoneWaitError extends FloodError {
  public seconds: number;

  constructor(args: any) {
    const seconds = Number(args.capture || 0);
    super(
      `A wait of ${seconds} seconds is required in the test servers${RPCError._fmtRequest(args.request)}`,
      args.request,
    );
    this.message = `A wait of ${seconds} seconds is required in the test servers${RPCError._fmtRequest(args.request)}`;
    this.seconds = seconds;
  }
}

export class FileMigrateError extends InvalidDCError {
  public newDc: number;

  constructor(args: any) {
    const newDc = Number(args.capture || 0);
    super(
      `The file to be accessed is currently stored in DC ${newDc}${RPCError._fmtRequest(args.request)}`,
      args.request,
    );
    this.message = `The file to be accessed is currently stored in DC ${newDc}${RPCError._fmtRequest(args.request)}`;
    this.newDc = newDc;
  }
}

export class NetworkMigrateError extends InvalidDCError {
  public newDc: number;

  constructor(args: any) {
    const newDc = Number(args.capture || 0);
    super(
      `The source IP address is associated with DC ${newDc}${RPCError._fmtRequest(args.request)}`,
      args.request,
    );
    this.message = `The source IP address is associated with DC ${newDc}${RPCError._fmtRequest(args.request)}`;
    this.newDc = newDc;
  }
}

export class EmailUnconfirmedError extends BadRequestError {
  codeLength: number;

  constructor(args: any) {
    const codeLength = Number(args.capture || 0);
    super(
      `Email unconfirmed, the length of the code must be ${codeLength}${RPCError._fmtRequest(
        args.request,
      )}`,
      args.request,
      400,
    );

    this.message = `Email unconfirmed, the length of the code must be ${codeLength}${RPCError._fmtRequest(
      args.request,
    )}`;
    this.codeLength = codeLength;
  }
}

export class PasswordFreshError extends BadRequestError {
  public seconds: number;

  constructor(args: any) {
    const seconds = Number(args.capture || 0);
    super(`The password was modified less than 24 hours ago, try again in ${seconds} seconds.`, args.request);

    this.message = `The password was modified less than 24 hours ago, try again in ${seconds} seconds.`;
    this.seconds = seconds;
  }
}

export class PasskeyLoginRequestedError extends Error {
  public credentialJson: PublicKeyCredentialJSON;

  constructor(credentialJson: PublicKeyCredentialJSON) {
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
    super('PASSKEY_CREDENTIAL_NOT_FOUND', args.request);
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
  [/^Timeout$/, TimedOutError],
  [/PASSKEY_CREDENTIAL_NOT_FOUND/, PasskeyCredentialNotFoundError],
]);
