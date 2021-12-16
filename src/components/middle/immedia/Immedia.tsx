import React, { useEffect, useState, useRef } from '../../../lib/teact/teact';
/* eslint-disable no-console */
const Immedia = () => {
  const [suggestedRoom, setSuggestedRoom] = useState('');
  const ws = useRef<WebSocket | undefined>(undefined);

  useEffect(() => {
    console.log('Entering ws useEffect');
    ws.current = new WebSocket('ws://localhost:3000/ws');
    ws.current.onopen = () => console.log('ws opened');
    ws.current.onclose = () => console.log('ws closed');

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('RECEIVED FROM ws!');
      console.log(data);
    };

    ws.current.onerror = (event) => {
      console.log('ws error');
      console.log(event);
    };
  }, []);

  // Connect to hhtp server
  useEffect(() => {
    const url = 'http://localhost:3000/suggestion.json';

    const fetchData = async () => {
      try {
        const response = await fetch(url);
        const json = await response.json();
        setSuggestedRoom(json.room);
      } catch (error) {
        console.log('error', error);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="MiddleHeader">
      Want to connect to the Room: {suggestedRoom}?
    </div>
  );
};
/* eslint-enable no-console */
export default Immedia;
