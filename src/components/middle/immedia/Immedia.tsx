import SockJS from 'sockjs-client';
import React, { useEffect, useState, useRef } from '../../../lib/teact/teact';

// String pre-attached to console.log messages
const INIT = 'IMMEDIA: ';

// Let prehook commit with console.logs
/* eslint-disable no-console */
const Immedia = () => {
  const [enteredRoom, setEnteredRoom] = useState(false);
  const [suggestedRoom, setSuggestedRoom] = useState('');
  const ws = useRef<WebSocket | undefined>(undefined);

  useEffect(() => {
    console.log(INIT, 'Entering ws useEffect');
    ws.current = new SockJS('http://localhost:3000/ws');
    ws.current.onopen = () => console.log(INIT, 'ws opened');
    ws.current.onclose = () => console.log(INIT, 'ws closed');

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log(INIT, 'RECEIVED FROM ws!');
      console.log(INIT, data);
    };

    ws.current.onerror = (event) => {
      console.log(INIT, 'ws error');
      console.log(INIT, event);
    };
  }, []);

  // Connect to http server
  useEffect(() => {
    const url = 'http://localhost:3000/suggestion.json';

    const fetchData = async () => {
      try {
        const response = await fetch(url);
        const json = await response.json();
        setSuggestedRoom(json.room);
      } catch (error) {
        console.log(INIT, 'error', error);
      }
    };
    fetchData();
  }, []);

  const enterRoom = () => {
    console.log(INIT, 'EnterRoom');
    if (ws.current) {
      ws.current.send(JSON.stringify({ room: suggestedRoom, type: 'sub' }));
      setEnteredRoom(true);
    }
  };

  const leaveRoom = () => {
    console.log(INIT, 'LeaveRoom');
    if (ws.current) {
      // not implemented in the backed
      // ws.current.send(JSON.stringify({room:suggestedRoom, type:"unsub"}));
      setEnteredRoom(false);
    }
  };

  return (
    <div className="MiddleHeader">
      {enteredRoom ? (
        <>
          Entered Room: {suggestedRoom}
          <button onClick={leaveRoom}>Leave</button>
        </>
      ) : (
        <>
          Want to connect to the Room: {suggestedRoom}?
          <button onClick={enterRoom}>Enter</button>
        </>
      )}
    </div>
  );
};
/* eslint-enable no-console */
export default Immedia;
