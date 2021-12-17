import SockJS from 'sockjs-client';
import React, { useEffect, useState, useRef } from '../../../lib/teact/teact';

import './Immedia.scss';

// String pre-attached to console.log messages
const INIT = 'IMMEDIA: ';

const SNAPSHOT_RATE = 500; // seconds

// Let prehook commit with console.logs
/* eslint-disable no-console */

const Immedia = () => {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  // TODO: When entered a room save it to local storage and retrieve it after
  const [enteredRoom, setEnteredRoom] = useState(false);
  const [suggestedRoom, setSuggestedRoom] = useState('');
  const ws = useRef<WebSocket | undefined>(undefined);

  // Generate webcam images when inside a room and send them to the server

  useEffect(() => {
    console.log(INIT, 'Entering ws useEffect');
    ws.current = new SockJS('http://localhost:3000/ws');
    ws.current.onopen = () => console.log(INIT, 'ws opened');
    ws.current.onclose = () => console.log(INIT, 'ws closed');

    ws.current.onmessage = (event) => {
      const { data } = JSON.parse(event.data);
      console.log(INIT, 'RECEIVED MESSAGE FROM ws!');
      console.log(INIT, data);
      if (data.id && data.id !== userId) {
        setUserId(data.id);
        console.log(INIT, 'SET USER ID: ', data.id);
      }
    };

    ws.current.onerror = (event) => {
      console.log(INIT, 'ws error');
      console.log(INIT, event);
    };
  }, [userId]);

  // Connect to http server
  useEffect(() => {
    const url = 'http://localhost:3000/suggestion.json';

    const fetchData = async () => {
      try {
        const response = await fetch(url);
        const json = await response.json();
        setSuggestedRoom(json.room);
      } catch (error) {
        console.error(`${INIT}error`, error);
      }
    };
    fetchData();
  }, []);

  const enterRoom = () => {
    console.log(INIT, 'EnterRoom');
    if (ws.current) {
      ws.current.send(
        JSON.stringify({
          room: suggestedRoom,
          type: 'sub',
          data: { password: false },
        }),
      );
      setEnteredRoom(true);
    }
  };

  // TODO: When leaving the room generate a new suggestedRoom query and work with array of rooms.
  // Also improve general room array handling.
  const leaveRoom = () => {
    console.log(INIT, 'LeaveRoom');
    if (ws.current) {
      ws.current.send(
        JSON.stringify({ id: userId, room: suggestedRoom, type: 'uns' }),
      );
      setEnteredRoom(false);
      setUserId(undefined);
      // no message is received when a subscriber leaves the room

      // TODO: stop video stream
    }
  };

  const boldMe = (text: string) => {
    return <strong>{text}</strong>;
  };

  useEffect(() => {
    const getSnapshotVideo = () => {
      if (enteredRoom) {
        const video = document.getElementById('video-me') as HTMLVideoElement;
        const canvas = document.getElementById(
          'canvas-me',
        ) as HTMLCanvasElement;
        if (canvas) {
          const context = canvas.getContext('2d');

          const cbk = (stream: MediaStream) => {
            if (video && context) {
              video.srcObject = stream;
              // Wait some time beacuse the video is not ready
              setTimeout(() => {
                // show snapshot
                context.drawImage(
                  video,
                  160,
                  120,
                  360,
                  240,
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
                // TODO: Send snapshot to server
              }, SNAPSHOT_RATE / 5);
            }
          };

          if (navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices
              .getUserMedia({ video: true, audio: false })
              .then((stream) => cbk(stream))
              .catch((err) => console.error(err));
          } else {
            console.error(new Error(`${INIT}There is no user media`));
          }
        }
      }
    };

    let result: NodeJS.Timeout;
    if (enteredRoom) {
      result = setInterval(getSnapshotVideo, SNAPSHOT_RATE);
    }
    return () => clearInterval(result);
  }, [enteredRoom]);

  return (
    <div className="MainImmedia">
      <div className="MiddleHeader">
        {enteredRoom ? (
          <>
            Entered Room: {boldMe(suggestedRoom)}
            <div className="HeaderActions">
              <button onClick={leaveRoom}>Leave</button>
            </div>
          </>
        ) : (
          <>
            Want to connect to the Room: {boldMe(suggestedRoom)}?
            <div className="HeaderActions">
              <button onClick={enterRoom}>Enter</button>
            </div>
          </>
        )}
      </div>
      {enteredRoom && (
        <div id="participants" className="Participants">
          <div>
            <video
              id="video-me"
              autoPlay
              className="videoStream"
              width="640"
              height="480"
            >
              <track kind="captions" /> {/* avoid eslint error */}
            </video>
            <canvas id="canvas-me" width="70" height="50" />
          </div>
          <div id="video-others" />
        </div>
      )}
    </div>
  );
};
/* eslint-enable no-console */
export default Immedia;
