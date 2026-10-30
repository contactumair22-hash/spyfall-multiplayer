```jsx
import React, { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Shield,
  Users,
  Copy,
  Check,
  ArrowRight,
  Eye,
  EyeOff,
  Clock3,
  Crown,
  Radio,
  RotateCcw,
  LogOut,
  Sparkles,
  AlertCircle
} from 'lucide-react';

// Connect to the deployed Render backend.
// VITE_SERVER_URL can override this value through Netlify settings.
const SERVER_URL = (
  import.meta.env.VITE_SERVER_URL ||
  'https://spyfall-multiplayer.onrender.com'
).replace(/\/+$/, '');

const socket = io(SERVER_URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
  timeout: 20000
});

const LOCATIONS = [
  'Airport',
  'Hospital',
  'School',
  'Beach',
  'Movie Theater',
  'Space Station',
  'Restaurant',
  'Police Station',
  'Museum',
  'Train Station',
  'Wedding',
  'Supermarket',
  'Casino',
  'Cruise Ship',
  'Farm',
  'Bank',
  'Library',
  'Stadium',
  'Hotel',
  'Submarine'
];

function App() {
  const [screen, setScreen] = useState('home');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [room, setRoom] = useState(null);
  const [playerId, setPlayerId] = useState('');
  const [role, setRole] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [voted, setVoted] = useState(false);
  const [guess, setGuess] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [connecting, setConnecting] = useState(!socket.connected);

  useEffect(() => {
    const onConnect = () => {
      setConnecting(false);
      setError('');
    };

    const onDisconnect = () => {
      setConnecting(true);
    };

    const onConnectError = () => {
      setConnecting(true);
      setError(
        'Could not connect to the game server. Please check the server status and refresh.'
      );
    };

    const onUpdate = data => {
      setRoom(data);

      if (data.status === 'lobby') {
        setRole(null);
        setReveal(null);
        setVoted(false);
        setGuess('');
      }

      if (data.status !== 'voting') {
        setVoted(false);
      }
    };

    const onRole = data => setRole(data);
    const onReveal = data => setReveal(data);
    const onError = msg => setError(String(msg));

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('room:update', onUpdate);
    socket.on('game:role', onRole);
    socket.on('game:reveal', onReveal);
    socket.on('game:error', onError);

    if (socket.connected) {
      setConnecting(false);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('room:update', onUpdate);
      socket.off('game:role', onRole);
      socket.off('game:reveal', onReveal);
      socket.off('game:error', onError);
    };
  }, []);

  useEffect(() => {
    if (room?.deadline && room.status === 'playing') {
      const tick = () => {
        setTimeLeft(
          Math.max(0, Math.ceil((room.deadline - Date.now()) / 1000))
        );
      };

      tick();

      const id = setInterval(tick, 1000);

      return () => clearInterval(id);
    }

    setTimeLeft(0);
  }, [room?.deadline, room?.status]);

  const me = useMemo(
    () => room?.players?.find(p => p.id === playerId),
    [room, playerId]
  );

  const isHost = room?.hostId === playerId;
  const isSpy = role?.isSpy;

  const send = (event, payload = {}) =>
    new Promise(resolve => {
      setError('');

      if (!socket.connected) {
        setError(
          'You are not connected to the game server. Please wait and try again.'
        );
        resolve({ error: 'Not connected to the game server.' });
        return;
      }

      socket.timeout(10000).emit(event, payload, (timeoutError, result) => {
        if (timeoutError) {
          setError(
            'The server did not respond in time. Please try again.'
          );
          resolve({ error: 'Server response timed out.' });
          return;
        }

        if (result?.error) {
          setError(result.error);
        }

        resolve(result || {});
      });
    });

  async function createRoom(e) {
    e?.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your codename first.');
      return;
    }

    if (!socket.connected) {
      setError('Connecting to the game server. Please wait a moment.');
      return;
    }

    const result = await send('room:create', { name });

    if (result?.room) {
      setRoom(result.room);
      setPlayerId(result.playerId);
      setScreen('room');
      setNotice('Room created. Invite your crew!');
    }
  }

  async function joinRoom(e) {
    e?.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your codename first.');
      return;
    }

    if (!code.trim()) {
      setError('Please enter the room code.');
      return;
    }

    if (!socket.connected) {
      setError('Connecting to the game server. Please wait a moment.');
      return;
    }

    const result = await send('room:join', { name, code });

    if (result?.room) {
      setRoom(result.room);
      setPlayerId(result.playerId);
      setScreen('room');
      setNotice('You joined the room.');
    }
  }

  async function copyInvite() {
    if (!room?.code) return;

    const invite = `${window.location.origin}/?room=${room.code}`;

    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setNotice(`Share room code ${room.code} with your friends.`);
    }
  }

  useEffect(() => {
    const inviteCode = new URLSearchParams(window.location.search).get('room');

    if (inviteCode) {
      setCode(inviteCode.toUpperCase());
    }
  }, []);

  function leave() {
    if (socket.connected) {
      socket.emit('room:leave', {});
    }

    setRoom(null);
    setRole(null);
    setReveal(null);
    setPlayerId('');
    setScreen('home');
    setError('');

    window.history.replaceState({}, '', window.location.pathname);
  }

  const start = () => send('game:start');
  const beginVote = () => send('game:begin-vote');

  const vote = async targetId => {
    const result = await send('game:vote', { targetId });

    if (result?.ok) {
      setVoted(true);
    }
  };

  const spyGuess = () => {
    if (guess) {
      send('game:spy-guess', { guess });
    }
  };

  const nextRound = () => {
    setRole(null);
    setReveal(null);
    setGuess('');
    setVoted(false);
    send('game:next-round');
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={e => {
            e.preventDefault();
            if (!room) setScreen('home');
          }}
        >
          <span className="brand-mark">
            <Shield size={21} strokeWidth={2.3} />
          </span>

          <span>
            SPYFALL<span className="brand-dot">.</span>
            <small>TRUST NOBODY</small>
          </span>
        </a>

        <div className="topbar-right">
          <span className="live-pill">
            <span className="pulse-dot" />
            LIVE MULTIPLAYER
          </span>
          <span className="version">BETA · 1.0</span>
        </div>
      </header>

      {screen === 'home' && (
        <main className="home-layout">
          <section className="hero">
            <div className="eyebrow">
              <Sparkles size={14} /> THE SOCIAL DEDUCTION GAME
            </div>

            <h1>
              Trust your friends.
              <br />
              <span>Question everything.</span>
            </h1>

            <p className="hero-copy">
              One of you is a spy. Everyone else knows the location. Ask clever
              questions, stay undercover, and expose the imposter before time
              runs out.
            </p>

            <div className="feature-row">
              <span>
                <Users size={16} /> 3–12 players
              </span>
              <span>
                <Clock3 size={16} /> 5-minute rounds
              </span>
              <span>
                <Radio size={16} /> Real-time play
              </span>
            </div>

            <div className="hero-art" aria-label="Game illustration">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />

              <div className="radar">
                <div className="radar-sweep" />
                <div className="radar-center">
                  <Shield size={38} />
                </div>
                <span className="radar-dot dot-a" />
                <span className="radar-dot dot-b" />
                <span className="radar-dot dot-c" />
              </div>

              <div className="art-tag tag-left">
                <span className="tag-icon">
                  <Eye size={15} />
                </span>
                <span>
                  IDENTITY UNKNOWN
                  <small>Someone is lying.</small>
                </span>
              </div>

              <div className="art-tag tag-right">
                <span className="tag-icon amber">
                  <AlertCircle size={15} />
                </span>
                <span>
                  THREAT DETECTED
                  <small>Can you spot them?</small>
                </span>
              </div>

              <div className="art-number">
                01 <span>/ 20 LOCATIONS</span>
              </div>
            </div>
          </section>

          <section className="join-card">
            <div className="card-heading">
              <span className="mini-icon">
                <Users size={18} />
              </span>

              <div>
                <h2>Enter the operation</h2>
                <p>Make a room or join your crew.</p>
              </div>
            </div>

            <form onSubmit={createRoom} className="form-stack">
              <label htmlFor="display-name">YOUR CODENAME</label>

              <input
                id="display-name"
                value={name}
                onChange={e => setName(e.target.value.slice(0, 18))}
                placeholder="e.g. Agent Nova"
                maxLength={18}
                required
                autoComplete="nickname"
              />

              <button
                className="primary-button"
                type="submit"
                disabled={connecting}
              >
                {connecting ? 'Connecting…' : 'Create a room'}
                <ArrowRight size={17} />
              </button>
            </form>

            <div className="separator">
              <span />
              OR JOIN AN EXISTING ROOM
              <span />
            </div>

            <form onSubmit={joinRoom} className="form-stack">
              <label htmlFor="room-code">ROOM CODE</label>

              <input
                id="room-code"
                className="code-input"
                value={code}
                onChange={e =>
                  setCode(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, 6)
                  )
                }
                placeholder="ABC123"
                maxLength={6}
                required
              />

              <button
                className="secondary-button"
                type="submit"
                disabled={connecting}
              >
                Join room <ArrowRight size={17} />
              </button>
            </form>

            {connecting && (
              <p className="connection-note" role="status">
                Connecting to the game server…
              </p>
            )}

            {error && (
              <p className="error-banner" role="alert">
                <AlertCircle size={16} />
                {error}
              </p>
            )}

            <div className="privacy-note">
              <Shield size={14} />
              No account. No download. Just your crew.
            </div>
          </section>

          <section className="how-section">
            <div className="section-kicker">THE PLAYBOOK</div>
            <h2>Three steps. One spy.</h2>

            <div className="steps-grid">
              <article>
                <span className="step-no">01</span>
                <h3>Get your secret</h3>
                <p>
                  Everyone gets a role and location. The spy gets neither.
                </p>
              </article>

              <article>
                <span className="step-no">02</span>
                <h3>Ask. Answer. Blend in.</h3>
                <p>
                  Ask questions that reveal knowledge without giving the
                  location away.
                </p>
              </article>

              <article>
                <span className="step-no">03</span>
                <h3>Find the imposter</h3>
                <p>
                  Vote before time runs out. Catch the spy to win the round.
                </p>
              </article>
            </div>
          </section>
        </main>
      )}

      {screen === 'room' && room && (
        <main className="room-layout">
          <div className="room-heading">
            <div>
              <div className="section-kicker">MISSION CONTROL</div>
              <h1>
                Room <span className="accent">{room.code}</span>
              </h1>
              <p>{room.message}</p>
            </div>

            <button className="icon-button leave-button" onClick={leave}>
              <LogOut size={16} /> Leave
            </button>
          </div>

          <div className="room-grid">
            <section className="panel players-panel">
              <div className="panel-title">
                <h2>
                  <Users size={18} /> Players{' '}
                  <span className="count-badge">
                    {room.totalPlayers}/12
                  </span>
                </h2>

                <span className="status-label">
                  <span className="pulse-dot" />
                  {room.status.toUpperCase()}
                </span>
              </div>

              <div className="player-list">
                {room.players.map((p, i) => (
                  <div
                    className={`player-row ${
                      p.id === playerId ? 'is-me' : ''
                    }`}
                    key={p.id}
                  >
                    <div className={`avatar avatar-${i % 5}`}>
                      {p.name.slice(0, 1).toUpperCase()}
                    </div>

                    <div className="player-info">
                      <strong>
                        {p.name}
                        {p.id === playerId ? ' (you)' : ''}
                      </strong>

                      <small>
                        {p.isHost
                          ? 'Room host'
                          : p.connected
                            ? 'Agent online'
                            : 'Reconnecting…'}
                      </small>
                    </div>

                    {p.isHost && <Crown size={16} className="host-icon" />}

                    <span className="score-pill">{p.score} pts</span>
                  </div>
                ))}
              </div>

              {room.status === 'lobby' && (
                <div className="lobby-actions">
                  {isHost ? (
                    <button
                      className="primary-button"
                      onClick={start}
                      disabled={room.totalPlayers < 3}
                    >
                      Start round <ArrowRight size={17} />
                    </button>
                  ) : (
                    <div className="waiting-note">
                      <span className="pulse-dot" />
                      Waiting for the host to start…
                    </div>
                  )}

                  <button
                    className="secondary-button share-button"
                    onClick={copyInvite}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Invite copied' : 'Copy invite link'}
                  </button>

                  {room.totalPlayers < 3 && (
                    <small className="hint">
                      At least 3 players are required to start.
                    </small>
                  )}
                </div>
              )}
            </section>

            <section className="panel game-panel">
              {room.status === 'lobby' && (
                <div className="empty-state">
                  <div className="big-shield">
                    <Shield size={34} />
                  </div>

                  <div className="section-kicker">YOUR MISSION AWAITS</div>
                  <h2>Ready to find the spy?</h2>

                  <p>
                    Share the room link. Once at least 3 agents join, the host
                    can begin.
                  </p>

                  <div className="rule-box">
                    <strong>Quick rules</strong>
                    <ul>
                      <li>Most players know the secret location.</li>
                      <li>The spy must blend in and figure it out.</li>
                      <li>Ask questions, then vote to identify the spy.</li>
                      <li>
                        Spy caught = group wins. Wrong accusation = spy wins.
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              {room.status === 'playing' && (
                <div className="active-game">
                  <div className="game-topline">
                    <span className="section-kicker">ROUND {room.round}</span>

                    <span className="timer">
                      <Clock3 size={16} />
                      {`${Math.floor(timeLeft / 60)
                        .toString()
                        .padStart(2, '0')}:${(timeLeft % 60)
                        .toString()
                        .padStart(2, '0')}`}
                    </span>
                  </div>

                  <div className={`role-card ${isSpy ? 'spy-role' : ''}`}>
                    <div className="role-icon">
                      {isSpy ? <EyeOff size={25} /> : <Eye size={25} />}
                    </div>

                    <span className="section-kicker">YOUR SECRET ROLE</span>
                    <h2>{role ? role.role : 'Revealing role…'}</h2>

                    <p>
                      {!role
                        ? 'Your private role is loading. Please wait a moment.'
                        : isSpy
                          ? 'You are the spy. Blend in, ask smart questions, and guess the location before you are caught.'
                          : `The location is ${role.location}. Act natural and help the group spot the spy.`}
                    </p>

                    {role && !isSpy && (
                      <div className="location-chip">
                        <Shield size={15} />
                        {role.location}
                      </div>
                    )}
                  </div>

                  <div className="play-instructions">
                    <h3>Talk it out</h3>
                    <p>
                      Use your voice call or group chat outside this page to
                      ask each other questions. Keep answers subtle. Do not
                      say the location out loud.
                    </p>
                  </div>

                  {isSpy && (
                    <div className="guess-box">
                      <label htmlFor="spy-guess">
                        THINK YOU KNOW THE LOCATION?
                      </label>

                      <div className="guess-row">
                        <select
                          id="spy-guess"
                          value={guess}
                          onChange={e => setGuess(e.target.value)}
                        >
                          <option value="">Choose a location…</option>

                          {LOCATIONS.map(location => (
                            <option key={location} value={location}>
                              {location}
                            </option>
                          ))}
                        </select>

                        <button
                          className="primary-button"
                          onClick={spyGuess}
                          disabled={!guess}
                        >
                          Guess
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    className="secondary-button full-button"
                    onClick={beginVote}
                  >
                    Call a vote <ArrowRight size={16} />
                  </button>
                </div>
              )}

              {room.status === 'voting' && (
                <div className="voting-state">
                  <div className="big-shield amber-shield">
                    <Eye size={30} />
                  </div>

                  <div className="section-kicker">DECISION TIME</div>
                  <h2>Who is the spy?</h2>

                  <p>
                    Select one player. Your vote is private until the round
                    resolves.
                  </p>

                  <div className="vote-list">
                    {room.players
                      .filter(p => p.id !== playerId && p.connected)
                      .map(p => (
                        <button
                          key={p.id}
                          className={`vote-option ${
                            voted ? 'vote-disabled' : ''
                          }`}
                          disabled={voted}
                          onClick={() => vote(p.id)}
                        >
                          <span className="avatar small-avatar">
                            {p.name.slice(0, 1).toUpperCase()}
                          </span>

                          <strong>{p.name}</strong>
                          <ArrowRight size={16} />
                        </button>
                      ))}
                  </div>

                  <div className="vote-status">
                    {voted
                      ? 'Vote submitted. Waiting for other players…'
                      : `${room.votedCount} of ${room.totalPlayers} votes submitted`}
                  </div>
                </div>
              )}

              {room.status === 'results' && (
                <div className="results-state">
                  <div className="big-shield">
                    <Check size={32} />
                  </div>

                  <div className="section-kicker">MISSION REPORT</div>

                  <h2>
                    {room.winner === 'players'
                      ? 'Spy exposed.'
                      : 'Spy escapes.'}
                  </h2>

                  <p>{room.message}</p>

                  <div className="reveal-card">
                    <span>THE SPY WAS</span>
                    <strong>{reveal?.spyName || 'Revealing…'}</strong>
                    <span>SECRET LOCATION</span>
                    <strong>{reveal?.location || 'Revealing…'}</strong>
                  </div>

                  <div className="scoreboard">
                    <h3>Scoreboard</h3>

                    {[...room.players]
                      .sort((a, b) => b.score - a.score)
                      .map((p, i) => (
                        <div className="score-row" key={p.id}>
                          <span>{i + 1}</span>
                          <strong>{p.name}</strong>
                          <b>{p.score} pts</b>
                        </div>
                      ))}
                  </div>

                  {isHost ? (
                    <button
                      className="primary-button full-button"
                      onClick={nextRound}
                    >
                      <RotateCcw size={16} />
                      Play another round
                    </button>
                  ) : (
                    <div className="waiting-note">
                      <span className="pulse-dot" />
                      Waiting for host to start the next round…
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          {error && (
            <p className="error-banner room-error" role="alert">
              <AlertCircle size={16} />
              {error}
            </p>
          )}

          <div className="room-footer">
            <Shield size={14} />
            Your role is private. Keep it that way.
          </div>
        </main>
      )}

      <footer className="footer">
        <span>SPYFALL © 2026</span>
        <span>ONE SPY. NO TRUST.</span>
        <span>BUILT FOR YOUR CREW</span>
      </footer>

      {notice && (
        <div className="toast" role="status">
          {notice}
          <button onClick={() => setNotice('')} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
```
