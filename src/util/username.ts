export const MIN_USERNAME_LENGTH = 5;
export const MAX_USERNAME_LENGTH = 32;
export const USERNAME_REGEX = /^\D([a-zA-Z0-9_]+)$/;

export function isUsernameValid(username: string) {
  return username.length === 0 || (
    username.length >= MIN_USERNAME_LENGTH
    && username.length <= MAX_USERNAME_LENGTH
    && USERNAME_REGEX.test(username)
  );
}
