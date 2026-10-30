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
