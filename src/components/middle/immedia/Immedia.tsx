import SockJS from 'sockjs-client';
import React, { useEffect, useState, useRef } from '../../../lib/teact/teact';
import { DEBUG } from '../../../config';

import './Immedia.scss';

const WEBSOCKET_URL = DEBUG
  ? 'http://localhost:3000/ws'
  : 'http://immedia.herokuapp.com/ws';
// const WEBSOCKET_URL = "http://immedia.herokuapp.com/ws";

// String pre-attached to console.log messages
const INIT = 'IMMEDIA: ';

const SNAPSHOT_RATE = 500; // 0.5 seconds
// const PING_RATE = 1000 * 10; // 10 seconds
const UPDATE_RATE = 1000 * 5; // 1 second

// Let prehook commit with console.logs
/* eslint-disable no-console */
type ParticipantsType = {
  id: string;
  nickname?: string;
  timestamp?: number;
  image?: string;
};

type ImmediaProps = {
  chatId: string;
};

// TODO: We need to unsubscribe the user when
// he/she leaves the chat by clicking another chat for example.
// That can be solved by using ping/pong messages.

const Immedia = ({ chatId }: ImmediaProps) => {
  // State that tracks when update is being run. Triggers another update after UPDATE_RATE seconds.
  const [runningUpdate, setRunningUpdate] = useState(false);
  const [lastSnapshot, setLastSnapshot] = useState<string | undefined>(
    undefined,
  );
  const [messageId, setMessageId] = useState(0);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [nickname, setNickname] = useState('');
  // TODO: Remove. It's not necessary. When the component renders it's already connected.
  // Although an intermediate state is call it snooze and applied that feature.
  // Or be an awarness trigger. Simply refactor Enter Room <-> Awarness.
  const [enteredRoom, setEnteredRoom] = useState(false);
  const [participants, setParticipants] = useState<ParticipantsType[]>([]);
  const ws = useRef<WebSocket | undefined>(undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleMessage = (data: any) => {
    // TODO: Switch beetween data.types: 'join', 'update' and 'left'
    switch (data.type) {
      case 'join': {
        const joinedUser = data.data;
        if (!participants[joinedUser.id]) {
          console.log(INIT, 'USER JOINED!');
          setParticipants([...participants, { id: joinedUser }]);
          console.log(
            INIT,
            'THERE ARE ',
            1 + participants.length,
            'PARTICIPANTS IN THE ROOM',
          );
        }
        break;
      }
      case 'update': {
        const updatedUser = data.data;
        console.log(INIT, 'USER UPDATED!');
        setParticipants(
          participants.map((p) => (p.id === updatedUser.id ? updatedUser : p)),
        );
        break;
      }
      case 'left': {
        const leftUser = data.data;
        console.log(INIT, 'USER LEFT with ID: ', leftUser[0]);
        const filteredParticipants = participants.filter(
          (p) => p.id !== leftUser[0],
        );
        console.log(INIT, 'FILTERED RESULTS: ', filteredParticipants);
        setParticipants(filteredParticipants);
        break;
      }
      default:
        console.log(INIT, 'UNKNOWN MESSAGE TYPE!');
    }
  };

  useEffect(() => {
    // dont change reference to ws
    if (ws.current === undefined) ws.current = new SockJS(WEBSOCKET_URL);
    ws.current.onopen = () => console.log(INIT, 'ws opened');
    ws.current.onclose = () => console.log(INIT, 'ws closed');

    ws.current.onmessage = (event) => {
      const response = JSON.parse(event.data);
      const { data } = response;
      console.log(INIT, 'RECEIVED MESSAGE!');
      console.log(INIT, response);
      if (data.id && data.success === true) {
        console.log(INIT, 'SET USER ID: ', data.id);
        setUserId(data.id);
      }
      handleMessage(response);
    };

    ws.current.onerror = (event) => {
      console.log(INIT, 'ws error');
      console.log(INIT, event);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleMessage]);

  // Nickname is set when the user leaves a room, correct.
  // TODO: Remove this. It's not necessary.
  useEffect(() => {
    console.log(INIT, 'Setting nickname');
    setNickname('Matias');
  }, [userId]);

  const formatRoom = (room: string) => {
    // this will work for both new and old version of telegram
    // TODO: Check if this is how we have to implement it.
    return room.replace('s', '').replace('-', '');
  };

  const enterRoom = () => {
    console.log(INIT, 'EnterRoom');
    const currentMessageId = messageId + 1;
    setMessageId(currentMessageId);
    const message = {
      msgId: currentMessageId,
      type: 'sub',
      room: formatRoom(chatId),
      data: { password: false },
    };
    if (ws.current) {
      ws.current.send(JSON.stringify(message));
      setEnteredRoom(true);
    }
  };

  // TODO: When leaving the room generate a new suggestedRoom query and work with array of rooms.
  // Also improve general room array handling.
  const leaveRoom = () => {
    if (ws.current) {
      const currentMessageId = messageId + 1;
      setMessageId(currentMessageId);
      const message = {
        msgId: currentMessageId,
        id: userId,
        room: formatRoom(chatId),
        type: 'uns',
      };
      console.log(INIT, 'LeaveRoom');
      ws.current.send(JSON.stringify(message));
      setEnteredRoom(false);
      setUserId(undefined);
      setLastSnapshot(undefined);
      // TODO: stop video stream
    }
  };

  useEffect(() => {
    const getParticipantsSnapshots = () => {
      if (participants.length) {
        console.log(
          INIT,
          'There are ',
          participants.length,
          'participants to add.',
        );
        console.log(INIT, participants);
        // update each participant's snapshot
        participants.forEach((participant) => {
          console.log(INIT, 'Getting snapshot for', participant);
          const canvas = document.getElementById(
            `canvas-${participant.id}`,
          ) as HTMLCanvasElement;
          if (canvas) {
            const context = canvas.getContext('2d');
            const image = new Image();
            image.onload = () => {
              context?.drawImage(image, 0, 0, canvas.width, canvas.height);
            };
            if (participant.image) image.src = participant.image;
          }
        });
      }
    };

    let participantsInterval: NodeJS.Timeout;
    if (enteredRoom) {
      participantsInterval = setInterval(getParticipantsSnapshots, UPDATE_RATE);
    }
    return () => {
      clearInterval(participantsInterval);
    };
  }, [participants, enteredRoom]);

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
                // TODO: Send snapshot to server in an update message
                const image = canvas.toDataURL('image/png');
                setLastSnapshot(image);
              }, SNAPSHOT_RATE / 5);
            }
          };

          if (navigator.mediaDevices.getUserMedia) {
            // TODO: Rewrite using async/await
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
      // get webcam snapshots every SNAPSHOT_RATE seconds
      result = setInterval(getSnapshotVideo, SNAPSHOT_RATE);
    }
    return () => clearInterval(result);
  }, [enteredRoom]);

  const sendUpdate = () => {
    if (ws.current) {
      const currentMessageId = messageId + 1;
      setMessageId(currentMessageId);
      const message = {
        msgId: currentMessageId,
        id: userId,
        type: 'app',
        room: formatRoom(chatId),
        data: {
          type: 'update',
          data: {
            image: lastSnapshot,
            timestamp: new Date().getTime(),
            nickname,
          },
        },
      };
      console.log(INIT, 'Updating with message: ', message);
      ws.current.send(JSON.stringify(message));
      setRunningUpdate(false);
    }
  };

  // TODO: I think this approach is cleaner that using a Timeout.
  // But there's a problem with the function reading the states.
  // useEffect(() => {
  //   var updateInterval: NodeJS.Timeout;
  //   if (enteredRoom && userId !== undefined) {
  //     updateInterval = setInterval(sendUpdate, UPDATE_RATE);
  //   }
  //   return () => clearInterval(updateInterval);
  // }, [enteredRoom, userId]);

  useEffect(() => {
    // Run updates to backend when the user is inside a room
    // var updateInterval: NodeJS.Timeout | undefined = undefined;
    if (
      enteredRoom
      && lastSnapshot !== undefined
      && userId !== undefined
      && !runningUpdate
    ) {
      // console.log(INIT, "RUNNING UPDATE INTERVAL EVERY ", UPDATE_RATE);
      setRunningUpdate(true);
      // TODO: I think it's simpler to use the setInterval function.
      // updateInterval =
      setTimeout(sendUpdate, UPDATE_RATE);
    }
    // FIX: clear remaining timeouts. When we leave the room there is still some timeouts running.
    // else {
    //   console.error(INIT + "NOT RUNNING UPDATE INTERVAL");
    //   console.log(
    //     INIT,
    //     "lastSnapshot is undefined? ",
    //     lastSnapshot === undefined
    //   );
    //   console.log(INIT, "userId is undefined? ", userId === undefined);
    //   console.log(INIT, "runningUpdate is true? ", runningUpdate);
    //   console.log(INIT, "enteredRoom is true? ", enteredRoom);
    //   // if (!enteredRoom && updateInterval === undefined) {
    //   //   console.log(INIT, "Clear update interval");
    //   //   clearTimeout(updateInterval);
    //   // }
    // }
    // return () => clearTimeout(updateInterval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enteredRoom, userId, lastSnapshot, runningUpdate]);

  // TODO: Run PING and PONG messages to keep connection alive.
  // Keep Track of connection status
  // useEffect(() => {
  //   var pingInterval: NodeJS.Timeout;
  //   if (enteredRoom) {
  //     console.log(INIT, "RUNNING PING INTERVAL EVERY ", PING_RATE);
  //     // before entering a room ping and get-conf
  //     // this is not necessary
  //     pingInterval = setInterval(ping, PING_RATE);
  //     // getConf();
  //   }
  //   return () => clearInterval(pingInterval);
  // }, [enteredRoom]);

  // TODO: Remove this feature. We don't need to send text messages.
  const sendMessage = (text: string) => {
    // FIX: Make the function use the latest value of state.
    // I think the issue arises when the callback is sent the value used is the one when timeout was called.
    // async states?
    if (ws.current) {
      const currentMessageId = messageId + 1;
      setMessageId(currentMessageId);
      const message = {
        msgId: currentMessageId,
        id: userId,
        type: 'app',
        room: formatRoom(chatId),
        data: {
          type: 'message',
          data: {
            text,
            timestamp: new Date().getTime(),
            nickname,
            image: lastSnapshot,
          },
        },
      };
      console.log(INIT, 'Sending message: ', message);
      ws.current.send(JSON.stringify(message));
    }
  };

  // TODO: Remove this feature.
  const getAvailableMessages = () => {
    const currentMessageId = messageId + 1;
    setMessageId(currentMessageId);
    const message = {
      msgId: currentMessageId,
      id: userId,
      type: 'app',
      room: formatRoom(chatId),
      data: { type: 'get-all-messages', data: undefined },
    };
    console.log(INIT, 'Getting available messages: ', message);
    if (ws.current) {
      ws.current.send(JSON.stringify(message));
    }
  };

  // const ping = () => {
  //   basicMessage("ping");
  // };

  // const getConf = () => {
  //   basicMessage("get-conf");
  // };

  // const basicMessage = (type: string) => {
  //   const currentMessageId = messageId + 1;
  //   setMessageId(currentMessageId);
  //   const message = {
  //     msgId: currentMessageId,
  //     type,
  //     room: formatRoom(chatId),
  //     data: null,
  //   };
  //   console.log(INIT, `${type.toUpperCase()}: `, message);
  //   if (ws.current) {
  //     ws.current.send(JSON.stringify(message));
  //   }
  // };

  const getRandomString = () => {
    return Math.random().toString(36).substring(2, 15);
  };

  return (
    <div className="MainImmedia">
      <div className="MiddleHeader">
        {enteredRoom ? (
          <>
            <div className="HeaderActions">
              <button onClick={() => sendMessage(getRandomString())}>
                Message
              </button>
              <button onClick={leaveRoom}>Leave</button>
              <button onClick={getAvailableMessages}>
                Get Available Messages
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="HeaderActions">
              <button onClick={enterRoom}>Enter Room</button>
            </div>
          </>
        )}
      </div>
      {enteredRoom && (
        <div id="participants" className="Participants">
          <div id="me">
            <video
              id="video-me"
              autoPlay
              className="videoStream"
              width="640"
              height="480"
            >
              <track kind="captions" /> {/* avoid eslint error */}
            </video>
            <canvas
              id="canvas-me"
              className="CanvasVideo"
              width="70"
              height="50"
            />
          </div>
          <div id="others">
            {participants
              && participants.map(({ id }) => {
                return (
                  <canvas
                    className="CanvasVideo"
                    id={`canvas-${id}`}
                    width="70"
                    height="50"
                  />
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
};
/* eslint-enable no-console */
export default Immedia;
