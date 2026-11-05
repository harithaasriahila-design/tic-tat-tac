(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const cells = [...document.querySelectorAll(".cell")];

  const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  const STORAGE_KEY = "funTicTacToe_v1";

  let board = Array(9).fill("");
  let currentPlayer = "X";
  let gameOver = false;
  let history = [];

  let scores = { X: 0, O: 0, draw: 0 };
  let matchHistory = [];

  let elapsedSeconds = 0;
  let timerId = null;
  let audioContext = null;
  let winningLine = [];
  let matchSaved = false;
  let aiTimeout = null;

  const mode = $("gameMode");
  const playerXInput = $("playerX");
  const playerOInput = $("playerO");
  const difficulty = $("difficulty");

  function playerName(mark) {
    if (mark === "X") {
      return playerXInput.value.trim() || "Player X";
    }

    return mode.value === "ai"
      ? "Computer"
      : (playerOInput.value.trim() || "Player O");
  }

  // SAVE GAME DATA

  function saveData() {
    const data = {
      scores,
      matchHistory,
      theme: document.documentElement.dataset.theme || "dark",
      names: {
        X: playerXInput.value,
        O: playerOInput.value
      },
      mode: mode.value
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn("Could not save game data:", error);
    }
  }

  // LOAD SAVED DATA

  function loadData() {
    try {
      const data = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "{}"
      );

      if (data.scores) {
        scores = { ...scores, ...data.scores };
      }

      if (Array.isArray(data.matchHistory)) {
        matchHistory = data.matchHistory.slice(0, 12);
      }

      if (data.theme === "light" || data.theme === "dark") {
        document.documentElement.dataset.theme = data.theme;
      }

      if (data.names) {
        playerXInput.value = data.names.X || "Player X";
        playerOInput.value = data.names.O || "Player O";
      }

      if (data.mode === "ai" || data.mode === "pvp") {
        mode.value = data.mode;
      }

    } catch (error) {
      console.warn("Could not load saved data:", error);
    }
  }

  // PLAYER NAMES AND SCOREBOARD

  function updateNames() {
    $("scoreNameX").textContent = playerName("X");
    $("scoreNameO").textContent = playerName("O");
  }

  function updateScores() {
    $("scoreX").textContent = scores.X;
    $("scoreO").textContent = scores.O;
    $("scoreDraw").textContent = scores.draw;
    updateNames();
  }

  // GAME TIMER

  function startTimer() {
    if (timerId || gameOver) return;

    timerId = setInterval(() => {
      elapsedSeconds++;
      renderTimer();
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerId);
    timerId = null;
  }

  function renderTimer() {
    const mins = String(
      Math.floor(elapsedSeconds / 60)
    ).padStart(2, "0");

    const secs = String(
      elapsedSeconds % 60
    ).padStart(2, "0");

    $("timer").textContent = `${mins}:${secs}`;
  }

  // SOUND EFFECTS
  // Original Tamil-cinema-inspired tunes.
  // These are original melodies, not copied film songs.

  function playSound(
    frequency = 440,
    duration = 0.12,
    type = "sine",
    volume = 0.045
  ) {
    try {
      audioContext ||= new (
        window.AudioContext ||
        window.webkitAudioContext
      )();

      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const now = audioContext.currentTime;

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);

      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + duration
      );

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.start(now);
      oscillator.stop(now + duration);

    } catch (error) {
      console.warn("Audio is unavailable:", error);
    }
  }

  // PLAY A SERIES OF NOTES

  function playTune(
    notes,
    gap = 140,
    type = "triangle",
    noteLength = 0.18
  ) {
    notes.forEach((note, index) => {
      window.setTimeout(() => {
        playSound(note, noteLength, type, 0.04);
      }, index * gap);
    });
  }

  // X AND O MOVE SOUNDS

  function playMoveSound(mark) {
    if (mark === "X") {
      // Cheerful hero-entry style
      playTune(
        [392, 523, 659],
        85,
        "triangle",
        0.13
      );
    } else {
      // Sweet playful style
      playTune(
        [440, 554, 698],
        85,
        "sine",
        0.13
      );
    }
  }

  // WINNING MUSIC

  function playWinSound() {
    // Original victory celebration tune
    playTune(
      [523, 659, 784, 880, 1047, 1175, 1047],
      155,
      "triangle",
      0.22
    );

    window.setTimeout(() => {
      playTune(
        [784, 988, 1175, 1318],
        125,
        "sine",
        0.20
      );
    }, 1180);
  }

  // DRAW MUSIC

  function playDrawSound() {
    // Funny comic-style tune
    playTune(
      [587, 494, 440, 392, 440, 330],
      190,
      "square",
      0.16
    );
  }

  // UNDO SOUND

  function playUndoSound() {
    playTune(
      [660, 523, 392],
      75,
      "sine",
      0.10
    );
  }

  // WINNING CONFETTI ANIMATION

  function celebrateWin() {
    document.body.classList.add("winner-celebration");

    window.setTimeout(() => {
      document.body.classList.remove("winner-celebration");
    }, 1800);

    const layer = document.createElement("div");
    layer.className = "game-confetti";
    layer.setAttribute("aria-hidden", "true");

    const emojis = [
      "⭐", "🎉", "🌈", "✨", "🎈", "💖"
    ];

    for (let i = 0; i < 34; i++) {
      const piece = document.createElement("span");

      piece.className = "game-confetti-piece";
      piece.textContent = emojis[i % emojis.length];

      piece.style.left = `${Math.random() * 100}%`;
      piece.style.animationDelay =
        `${Math.random() * 0.65}s`;

      piece.style.setProperty(
        "--drift",
        `${Math.round(Math.random() * 160 - 80)}px`
      );

      layer.append(piece);
    }

    document.body.append(layer);

    window.setTimeout(() => {
      layer.remove();
    }, 2600);
  }

  // CHECK WINNER

  function getWinner(state = board) {
    for (const line of WIN_LINES) {
      const [a, b, c] = line;

      if (
        state[a] &&
        state[a] === state[b] &&
        state[a] === state[c]
      ) {
        return {
          winner: state[a],
          line
        };
      }
    }

    return null;
  }

  // DISPLAY GAME

  function render() {
    cells.forEach((cell, index) => {
      const mark = board[index];

      cell.textContent = mark;

      cell.classList.toggle("x", mark === "X");
      cell.classList.toggle("o", mark === "O");

      cell.classList.toggle(
        "win",
        winningLine.includes(index)
      );

      cell.disabled =
        Boolean(mark) ||
        gameOver ||
        (mode.value === "ai" && currentPlayer === "O");

      cell.setAttribute(
        "aria-label",
        `Cell ${index + 1}, ${mark || "empty"}`
      );
    });

    const winner = getWinner();

    $("status").textContent = gameOver
      ? (
          winner
            ? `${playerName(winner.winner).toUpperCase()} WINS!`
            : "IT'S A DRAW!"
        )
      : `${playerName(currentPlayer).toUpperCase()}'S TURN`;

    $("undo").disabled =
      history.length === 0 || gameOver;

    $("message").textContent = gameOver
      ? (
          winner
            ? "Fantastic move! Start a new match to play again."
            : "Good game! The board is full."
        )
      : (
          mode.value === "ai" && currentPlayer === "O"
            ? "Computer is thinking…"
            : "Choose an empty square to make your move."
        );
  }

  // SAVE MATCH HISTORY

  function saveMatch(result) {
    if (matchSaved) return;

    matchSaved = true;

    const winnerName =
      result === "draw"
        ? "Draw"
        : playerName(result);

    matchHistory.unshift({
      result: winnerName,

      detail:
        result === "draw"
          ? "Draw game"
          : `${winnerName} won`,

      mode:
        mode.value === "ai"
          ? "vs Computer"
          : "2 Players",

      time: new Date().toLocaleString()
    });

    matchHistory = matchHistory.slice(0, 12);

    renderHistory();
    saveData();
  }

  // FINISH GAME

  function finishGame() {
    const result = getWinner();

    if (result) {
      gameOver = true;
      winningLine = result.line;

      scores[result.winner]++;

      stopTimer();

      playWinSound();
      celebrateWin();

      saveMatch(result.winner);

    } else if (board.every(Boolean)) {
      gameOver = true;

      scores.draw++;

      stopTimer();

      playDrawSound();

      saveMatch("draw");

    } else {
      return false;
    }

    updateScores();
    saveData();
    render();

    return true;
  }

  // PLAYER MOVE

  function makeMove(index, mark = currentPlayer) {
    if (
      gameOver ||
      board[index] ||
      index < 0 ||
      index > 8
    ) {
      return false;
    }

    history.push({
      board: [...board],
      currentPlayer
    });

    board[index] = mark;

    playMoveSound(mark);

    const chosenCell = cells[index];

    chosenCell.classList.remove("cell-pop");
    void chosenCell.offsetWidth;
    chosenCell.classList.add("cell-pop");

    if (finishGame()) {
      return true;
    }

    currentPlayer = mark === "X" ? "O" : "X";

    render();

    if (mode.value === "ai" && currentPlayer === "O") {
      cells.forEach(cell => {
        cell.disabled = true;
      });

      aiTimeout = window.setTimeout(computerMove, 450);
    }

    return true;
  }

  // AVAILABLE MOVES

  function availableMoves(state) {
    return state
      .map((value, index) => value ? -1 : index)
      .filter(index => index !== -1);
  }

  // FIND WINNING MOVE

  function findWinningMove(state, mark) {
    for (const index of availableMoves(state)) {
      const copy = [...state];

      copy[index] = mark;

      if (getWinner(copy)) {
        return index;
      }
    }

    return null;
  }

  // MINIMAX AI ALGORITHM

  function minimax(state, isMaximizing) {
    const result = getWinner(state);

    if (result?.winner === "O") return 10;
    if (result?.winner === "X") return -10;

    const moves = availableMoves(state);

    if (!moves.length) return 0;

    if (isMaximizing) {
      let best = -Infinity;

      for (const index of moves) {
        state[index] = "O";

        best = Math.max(
          best,
          minimax(state, false)
        );

        state[index] = "";
      }

      return best;

    } else {
      let best = Infinity;

      for (const index of moves) {
        state[index] = "X";

        best = Math.min(
          best,
          minimax(state, true)
        );

        state[index] = "";
      }

      return best;
    }
  }

  // COMPUTER DIFFICULTY

  function chooseComputerMove() {
    const moves = availableMoves(board);

    if (!moves.length) return null;

    // EASY MODE

    if (difficulty.value === "easy") {
      return moves[
        Math.floor(Math.random() * moves.length)
      ];
    }

    const win = findWinningMove(board, "O");
    const block = findWinningMove(board, "X");

    // MEDIUM MODE

    if (difficulty.value === "medium") {
      if (win !== null) return win;

      if (block !== null && Math.random() < 0.8) {
        return block;
      }

      if (!board[4]) return 4;

      const corners = [0, 2, 6, 8].filter(
        index => !board[index]
      );

      if (corners.length) {
        return corners[
          Math.floor(Math.random() * corners.length)
        ];
      }

      return moves[
        Math.floor(Math.random() * moves.length)
      ];
    }

    // HARD MODE

    let bestScore = -Infinity;
    let bestMoves = [];

    for (const index of moves) {
      board[index] = "O";

      const score = minimax(board, false);

      board[index] = "";

      if (score > bestScore) {
        bestScore = score;
        bestMoves = [index];

      } else if (score === bestScore) {
        bestMoves.push(index);
      }
    }

    return bestMoves[
      Math.floor(Math.random() * bestMoves.length)
    ];
  }

  // COMPUTER TURN

  function computerMove() {
    aiTimeout = null;

    if (
      gameOver ||
      mode.value !== "ai" ||
      currentPlayer !== "O"
    ) {
      return;
    }

    const index = chooseComputerMove();

    if (index !== null) {
      makeMove(index, "O");
    }
  }

  // RESET BOARD

  function resetBoard() {
    if (aiTimeout) {
      clearTimeout(aiTimeout);
      aiTimeout = null;
    }

    board = Array(9).fill("");

    currentPlayer = "X";
    gameOver = false;

    history = [];
    winningLine = [];

    elapsedSeconds = 0;
    matchSaved = false;

    stopTimer();

    renderTimer();
    render();
  }

  // UNDO MOVE

  function undoMove() {
    if (!history.length || gameOver) {
      return;
    }

    if (aiTimeout) {
      clearTimeout(aiTimeout);
      aiTimeout = null;
    }

    const steps =
      mode.value === "ai" && history.length >= 2
        ? 2
        : 1;

    let previous;

    for (
      let i = 0;
      i < steps && history.length;
      i++
    ) {
      previous = history.pop();
    }

    if (!previous) return;

    board = [...previous.board];
    currentPlayer = previous.currentPlayer;

    winningLine = [];

    render();

    playUndoSound();
  }

  // DISPLAY MATCH HISTORY

  function renderHistory() {
    const list = $("historyList");

    list.replaceChildren();

    if (!matchHistory.length) {
      const item = document.createElement("li");

      item.className = "empty-history";

      item.textContent =
        "Your completed matches will appear here.";

      list.append(item);

      return;
    }

    matchHistory.forEach(match => {
      const item = document.createElement("li");

      const left = document.createElement("span");
      const right = document.createElement("span");

      left.textContent =
        `${match.detail} · ${match.mode}`;

      right.textContent = match.time;

      item.append(left, right);

      list.append(item);
    });
  }

  // CHANGE GAME MODE

  function updateMode() {
    const aiMode = mode.value === "ai";

    $("playerOSetting").classList.toggle(
      "hidden",
      aiMode
    );

    $("difficultySetting").classList.toggle(
      "hidden",
      !aiMode
    );

    updateNames();

    resetBoard();
    saveData();
  }

  // BOARD CLICK EVENTS

  cells.forEach(cell => {
    cell.addEventListener("click", () => {
      const index = Number(cell.dataset.index);

      if (!timerId && !gameOver) {
        startTimer();
      }

      makeMove(index);
    });
  });

  // BUTTON EVENTS

  $("undo").addEventListener("click", undoMove);

  $("restart").addEventListener("click", resetBoard);

  $("newMatch").addEventListener("click", resetBoard);

  $("clearHistory").addEventListener("click", () => {
    matchHistory = [];

    renderHistory();
    saveData();
  });

  // MODE CHANGE

  mode.addEventListener("change", updateMode);

  // PLAYER NAME CHANGE

  [playerXInput, playerOInput].forEach(input => {
    input.addEventListener("input", () => {
      updateNames();
      render();
      saveData();
    });
  });

  // DARK AND LIGHT THEME

  $("themeToggle").addEventListener("click", () => {
    const nextTheme =
      document.documentElement.dataset.theme === "light"
        ? "dark"
        : "light";

    document.documentElement.dataset.theme = nextTheme;

    $("themeToggle").textContent =
      nextTheme === "light" ? "🌙" : "☀️";

    saveData();
  });

  // INITIALIZE GAME

  document.body.classList.add("kids-cinema-background");

  loadData();

  $("themeToggle").textContent =
    document.documentElement.dataset.theme === "light"
      ? "🌙"
      : "☀️";

  updateMode();
  updateScores();
  renderHistory();
  render();

})();