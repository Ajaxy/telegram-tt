/* eslint-disable no-null/no-null */
import React, { useRef } from '../../lib/teact/teact';

import useElectronDrag from '../../hooks/useElectronDrag';

import './Header.scss';

const Header = () => {
  // Теперь useRef принимает HTMLDivElement
  const headerDraggerRef = useRef<HTMLDivElement>(null);
  useElectronDrag(headerDraggerRef);

  return (
    <div
      id="header-dragger-root"
      ref={headerDraggerRef}
    >
      {/* Содержимое вашего компонента */}
    </div>
  );
};

export default Header;
