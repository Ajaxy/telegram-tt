import type React from '../lib/teact/teact';

const stopEvent = (e: React.UIEvent | Event | React.FormEvent) => {
  e.stopPropagation();
  e.preventDefault();
};

export default stopEvent;
