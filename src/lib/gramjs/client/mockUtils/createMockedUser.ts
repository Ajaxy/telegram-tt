import BigInt from 'big-integer';

import type { MockTypes } from './MockTypes';

import Api from '../../tl/api';

export default function createMockedUser(id: string, mockData: MockTypes): Api.User {
  const user = mockData.users.find((user) => user.id === id);

  if (!user) throw Error('No such user ' + id);

  const {
    firstName = 'John',
    lastName = 'Doe',
    accessHash = BigInt(1),
    ...rest
  } = user;

  return new Api.User({
    ...rest,
    id: BigInt(id),
    firstName,
    lastName,
    accessHash,
  });
}
