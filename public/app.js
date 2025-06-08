let ws;
let myPlayer = "";
let currentPlayer = "X";
let gameBoard = ["", "", "", "", "", "", "", "", ""];
let gameActive = false;
let isMyTurn = false;
let gameId = "";

const cells = document.querySelectorAll(".cell");
const connectionStatusEl = document.getElementById("connectionStatus");
const connectionPanelEl = document.getElementById("connectionPanel");
const gameSectionEl = document.getElementById("gameSection");
const currentPlayerEl = document.getElementById("currentPlayer");
const gameMessageEl = document.getElementById("gameMessage");
const playerRoleEl = document.getElementById("playerRole");

// اتصال به سرور
function connectToServer() {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${protocol}//${window.location.host}`;

  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("متصل به سرور شد");
    connectionStatusEl.textContent = "آماده شروع بازی";
    connectionStatusEl.className = "connection-status status-connected";
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleServerMessage(data);
  };

  ws.onclose = () => {
    console.log("اتصال به سرور قطع شد");
    connectionStatusEl.textContent = "اتصال قطع شد";
    connectionStatusEl.className = "connection-status status-disconnected";
  };

  ws.onerror = (error) => {
    console.error("خطا در اتصال:", error);
    connectionStatusEl.textContent = "خطا در اتصال به سرور";
    connectionStatusEl.className = "connection-status status-disconnected";
  };
}

// مدیریت پیام‌های سرور
function handleServerMessage(data) {
  switch (data.type) {
    case "game_created":
      onGameCreated(data);
      break;
    case "game_started":
      onGameStarted(data);
      break;
    case "move_made":
      onMoveMade(data);
      break;
    case "game_reset":
      onGameReset(data);
      break;
    case "player_disconnected":
      onPlayerDisconnected();
      break;
    case "error":
      alert(data.message);
      break;
  }
}

// ایجاد بازی جدید
function createGame() {
  gameId = generateId();
  sendMessage({
    type: "create_game",
    gameId: gameId,
  });
}

// بازی ایجاد شد
function onGameCreated(data) {
  myPlayer = data.player;
  document.getElementById("gameIdShow").value = data.gameId;
  document.getElementById("gameIdDisplay").style.display = "block";

  connectionStatusEl.textContent = "در انتظار بازیکن دوم...";
  connectionStatusEl.className = "connection-status status-waiting";
}

// نمایش بخش پیوستن
function showJoinSection() {
  document.getElementById("joinSection").style.display = "block";
}

// پیوستن به بازی
function joinGame() {
  const inputGameId = document.getElementById("gameIdInput").value.trim();
  if (!inputGameId) {
    alert("لطفاً کد بازی را وارد کنید");
    return;
  }

  gameId = inputGameId;
  sendMessage({
    type: "join_game",
    gameId: gameId,
  });
}

// بازی شروع شد
function onGameStarted(data) {
  myPlayer = data.player;
  gameBoard = data.board;
  currentPlayer = data.currentPlayer;

  startGame();
}

// شروع بازی
function startGame() {
  connectionPanelEl.style.display = "none";
  gameSectionEl.classList.add("active");

  playerRoleEl.textContent = myPlayer;
  playerRoleEl.style.color = myPlayer === "X" ? "#e53e3e" : "#3182ce";

  gameActive = true;
  isMyTurn = myPlayer === currentPlayer;
  updateGameState();

  // فعال کردن event listeners
  cells.forEach((cell) => {
    cell.addEventListener("click", handleCellClick);
  });
}

// مدیریت کلیک بر خانه
function handleCellClick(e) {
  const clickedCell = e.target;
  const clickedCellIndex = parseInt(clickedCell.getAttribute("data-index"));

  if (gameBoard[clickedCellIndex] !== "" || !gameActive || !isMyTurn) {
    return;
  }

  makeMove(clickedCellIndex);
}

// انجام حرکت
function makeMove(index) {
  sendMessage({
    type: "make_move",
    index: index,
  });
}

// حرکت انجام شد
function onMoveMade(data) {
  gameBoard = data.board;
  currentPlayer = data.currentPlayer;

  // به‌روزرسانی خانه
  updateCell(data.index, data.player);

  if (data.winner) {
    endGame(`بازیکن ${data.winner} برنده شد!`);
    highlightWinner(data.board);
  } else if (data.isDraw) {
    endGame("بازی مساوی شد!");
  } else {
    isMyTurn = myPlayer === currentPlayer;
    updateGameState();
  }
}

// به‌روزرسانی خانه
function updateCell(index, player) {
  const cell = cells[index];
  cell.textContent = player;
  cell.classList.add(player.toLowerCase());
}

// برجسته کردن خانه‌های برنده
function highlightWinner(board) {
  const winningConditions = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (let condition of winningConditions) {
    const [a, b, c] = condition;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      cells[a].classList.add("winning-cell");
      cells[b].classList.add("winning-cell");
      cells[c].classList.add("winning-cell");
      break;
    }
  }
}

// به‌روزرسانی وضعیت بازی
function updateGameState() {
  currentPlayerEl.textContent = currentPlayer;
  currentPlayerEl.style.color = currentPlayer === "X" ? "#e53e3e" : "#3182ce";

  if (!gameActive) {
    return;
  }

  if (isMyTurn) {
    gameMessageEl.textContent = "نوبت شماست!";
    gameMessageEl.style.background = "#c6f6d5";
    gameMessageEl.style.color = "#2f855a";
  } else {
    gameMessageEl.textContent = "منتظر حرکت حریف...";
    gameMessageEl.style.background = "#fef5e7";
    gameMessageEl.style.color = "#dd6b20";
  }
}

// پایان بازی
function endGame(message) {
  gameActive = false;
  isMyTurn = false;
  gameMessageEl.textContent = message;
  gameMessageEl.className = "game-message winner-message";

  cells.forEach((cell) => {
    cell.disabled = true;
  });
}

// ریست بازی
function resetGame() {
  sendMessage({
    type: "reset_game",
  });
}

// بازی ریست شد
function onGameReset(data) {
  gameBoard = data.board;
  currentPlayer = data.currentPlayer;
  gameActive = true;
  isMyTurn = myPlayer === currentPlayer;

  cells.forEach((cell) => {
    cell.textContent = "";
    cell.disabled = false;
    cell.className = "cell";
  });

  updateGameState();
}

// بازیکن قطع شد
function onPlayerDisconnected() {
  gameActive = false;
  gameMessageEl.textContent = "بازیکن دیگر قطع شد";
  gameMessageEl.style.background = "#fed7d7";
  gameMessageEl.style.color = "#c53030";
}

// خروج از بازی
function leaveGame() {
  if (ws) {
    ws.close();
  }
  window.location.reload();
}

// ارسال پیام
function sendMessage(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// تولید ID تصادفی
function generateId() {
  return Math.random().toString(36).substr(2, 8).toUpperCase();
}

// اتصال به سرور هنگام بارگیری صفحه
window.addEventListener("load", () => {
  connectToServer();
});
