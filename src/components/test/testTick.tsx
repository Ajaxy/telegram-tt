import React from '../../lib/teact/teact';
import TeactDOM from '../../lib/teact/teact-dom';

function tick() {
  const element = (
    <div>
      <h1>Hello, world!</h1>
      <h2>It is {new Date().toLocaleTimeString()}.</h2>
    </div>
  );
  TeactDOM.render(element, document.getElementById('root')!);
}

setInterval(tick, 1000);
