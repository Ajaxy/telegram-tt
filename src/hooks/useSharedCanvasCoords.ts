import { useEffect, useMemo, useState } from '../lib/teact/teact';

export default function useSharedCanvasCoords(
  containerRef: React.RefObject<HTMLDivElement>,
  sharedCanvasRef?: React.RefObject<HTMLCanvasElement>,
) {
  const [x, setX] = useState<number>();
  const [y, setY] = useState<number>();

  useEffect(() => {
    if (!sharedCanvasRef?.current) {
      return;
    }

    const container = containerRef.current!;
    const target = container.classList.contains('sticker-set-cover') ? container : container.querySelector('img')!;
    const targetBounds = target.getBoundingClientRect();
    const canvasBounds = sharedCanvasRef!.current!.getBoundingClientRect();

    // Factor coords are used to support rendering while being rescaled (e.g. message appearance animation)
    setX((targetBounds.left - canvasBounds.left) / canvasBounds.width);
    setY((targetBounds.top - canvasBounds.top) / canvasBounds.height);
  }, [containerRef, sharedCanvasRef]);

  return useMemo(() => (x !== undefined && y !== undefined ? { x, y } : undefined), [x, y]);
}
