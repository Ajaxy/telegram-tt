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

const GC_RATE = 1500; // 1.5 seconds
const REMOVE_THRESHOLD = 1000 * 20; // 20 seconds
const SNAPSHOT_RATE = 500; // 0.5 seconds
const PING_RATE = 1000 * 5; // 5 seconds
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

  const isParticipantPresent = (id: string) => participants.some((p) => p.id === id);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleMessage = (data: any) => {
    switch (data.type) {
      case 'join': {
        const joinedUser = data.data;
        if (!isParticipantPresent(joinedUser.id)) {
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
        // check if participant is already present
        if (isParticipantPresent(updatedUser.id)) {
          console.log(INIT, 'USER UPDATED!');
          setParticipants(
            participants.map((p) => (p.id === updatedUser.id ? updatedUser : p)),
          );
        } else {
          // TODO: Use code from join
          console.log(INIT, 'USER CREATED!');
          setParticipants([...participants, updatedUser]);
          console.log(
            INIT,
            'THERE ARE ',
            1 + participants.length,
            'PARTICIPANTS IN THE ROOM',
          );
        }
        break;
      }
      case 'left': {
        // TODO: Set a warning message if leftUser has length > 1 or better, handle accordingly.
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
  // TODO: Set the user first name/ last name or username from Telegram API as nickname.
  useEffect(() => {
    console.log(INIT, 'Setting nickname');
    setNickname('Matias');
  }, [userId]);

  const formatRoom = (room: string) => {
    // this will work for both new and old version of telegram
    // TODO: Check if this is how we have to implement it.
    return room.replace('s', '').replace('-', '');
  };
  // TODO: Correct true value of messageId. Using callbacks overwrites the value.
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

  // GC that runs every GC_RATE seconds and checks if, for each participant,
  // their last snapshot was taken inside a REMOVE_THRESHOLD seconds time frame.
  // If not, it will remove the participant.
  useEffect(() => {
    const updateParticipants = () => {
      console.log(INIT, 'Garbage collect participants');
      participants.forEach((participant) => {
        const removeThreshold = new Date().getTime() - REMOVE_THRESHOLD;
        if (participant.timestamp && participant.timestamp < removeThreshold) {
          console.log(INIT, 'Garbage collect participant', participant.id);
          setParticipants(participants.filter((p) => p.id !== participant.id));
        }
      });
      if (participants.length === 0) {
        console.log(INIT, 'There is 1 participant left');
      } else {
        console.log(
          INIT,
          'There are',
          1 + participants.length,
          'participants left.',
        );
      }
    };

    if (participants.length) {
      let participantsInterval: NodeJS.Timeout;
      if (enteredRoom) {
        participantsInterval = setInterval(updateParticipants, GC_RATE);
      }
      return () => clearInterval(participantsInterval);
    }
    return undefined;
  }, [enteredRoom, participants]);

  useEffect(() => {
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
      }
    };
    if (lastSnapshot !== undefined && userId !== undefined) {
      let updateInterval: NodeJS.Timeout;
      if (enteredRoom) {
        console.log(INIT, 'Running Updates');
        updateInterval = setInterval(sendUpdate, UPDATE_RATE);
      }
      return () => clearInterval(updateInterval);
    }
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enteredRoom, userId, messageId, nickname, chatId]);

  // TODO: Run PING and PONG messages to keep connection alive.
  // Keep Track of connection status
  useEffect(() => {
    const ping = () => {
      const type = 'ping';
      if (ws.current) {
        const currentMessageId = messageId + 1;
        setMessageId(currentMessageId);
        const message = {
          msgId: currentMessageId,
          type,
          room: formatRoom(chatId),
          data: undefined,
        };
        console.log(INIT, `${type.toUpperCase()}: `, message);
        ws.current.send(JSON.stringify(message));
      }
    };

    if (chatId !== undefined && userId !== undefined) {
      let pingInterval: NodeJS.Timeout;
      if (enteredRoom) {
        console.log(INIT, 'RUNNING PING INTERVAL EVERY ', PING_RATE);
        pingInterval = setInterval(ping, PING_RATE);
      }
      return () => clearInterval(pingInterval);
    }
    return undefined;
  }, [enteredRoom, userId, messageId, chatId]);

  // TODO: Define the Heartbeat function to keep track user connection.

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
          <div className="MeParticipant">
            <video
              id="video-me"
              autoPlay
              className="videoStream"
              width="640"
              height="480"
            >
              <track kind="captions" /> {/* avoid eslint error */}
            </video>
            <div className="VideoName">
              <canvas
                id="canvas-me"
                className="CanvasVideo"
                width="70"
                height="50"
              />
              <text className="Nickname">{nickname}</text>
            </div>
          </div>
          <div className="OtherParticipants">
            {participants
              && participants.map(
                ({ id, nickname: participantNickname }) => {
                  return (
                    <div key={id} className="VideoName">
                      <canvas
                        className="CanvasVideo"
                        id={`canvas-${id}`}
                        width="70"
                        height="50"
                      />
                      {/* FIX: Display image in place of canvas */}
                      {/* {image ||
                        (participantNickname && (
                          <i className="icon-video-stop"></i>
                        ))} */}
                      <text className="Nickname">
                        {participantNickname || '\u00a0\u00a0'}
                      </text>
                    </div>
                  );
                },
              )}
          </div>
        </div>
      )}
    </div>
  );
};
/* eslint-enable no-console */
export default Immedia;
