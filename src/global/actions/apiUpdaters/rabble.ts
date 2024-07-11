import axios from 'axios';

import { getGlobal, setGlobal } from '../..';

export async function createUser() {
  try {
    const response = await axios.post(
      'http://localhost:8080/wallets',
      //   'https://api-dev.pluto.buidl.so/wallets',
      { telegramId: '1234567890' },
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
    );
    const data = response.data;
    const oldGlobal = getGlobal();
    const userData = await getUser(data.accessToken);
    const userWallet = { ...userData, ...data };
    const global = { ...oldGlobal, userWallet };
    setGlobal(global);
  } catch (error: any) {
    console.log(error.message);
  }
}

export async function getUser(accessToken: string): Promise<any> {
  try {
    const response = await axios.get(
      'http://localhost:8080/wallets/me',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );
    const data = response.data;
    return data;
  } catch (error: any) {
    return console.log(error.message);
  }
}
