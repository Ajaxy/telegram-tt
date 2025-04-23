import { DEBUG } from '../config';

export { default as Main } from '../components/main/Main';
export { default as LockScreen } from '../components/main/LockScreen';

if (DEBUG) {
  // eslint-disable-next-line no-console
  console.log('>>> FINISH LOAD MAIN BUNDLE');
}
