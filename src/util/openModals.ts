import { createSignal } from './signals';

// Counted by both modal implementations; the 3D diamond stops drawing while anything covers it
const [getOpenModalCount, setOpenModalCount] = createSignal(0);

export { getOpenModalCount };

export function countOpenModal() {
  setOpenModalCount(getOpenModalCount() + 1);

  return () => {
    setOpenModalCount(Math.max(0, getOpenModalCount() - 1));
  };
}
