const WebSocket = require("ws");
const http = require("http");
const fs = require("fs");
const path = require("path");

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// ایجاد سرور HTTP
const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    fs.readFile(path.join(__dirname, "client.html"), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("خطا در خواندن فایل");
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(data);
    });
  } else {
    const filePath = path.join(__dirname, "public", req.url);
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || "application/octet-stream";

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(404);
        res.end("فایل یافت نشد");
      } else {
        res.writeHead(200, { "Content-Type": contentType });
        res.end(content);
      }
    });
  }
});

// ایجاد سرور WebSocket
const wss = new WebSocket.Server({ server });

// ذخیره اطلاعات بازی‌ها
const games = new Map();

wss.on("connection", (ws) => {
  console.log("کاربر جدید متصل شد");

  ws.on("message", (message) => {
    try {
      const data = JSON.parse(message);
      handleMessage(ws, data);
    } catch (error) {
      console.error("خطا در پردازش پیام:", error);
    }
  });

  ws.on("close", () => {
    console.log("کاربر قطع شد");
    handleDisconnect(ws);
  });
});

function handleMessage(ws, data) {
  switch (data.type) {
    case "create_game":
      createGame(ws, data.gameId);
      break;
    case "join_game":
      joinGame(ws, data.gameId);
      break;
    case "make_move":
      makeMove(ws, data);
      break;
    case "reset_game":
      resetGame(ws);
      break;
  }
}

function createGame(ws, gameId) {
  // ایجاد بازی جدید
  const game = {
    id: gameId,
    players: { X: ws, O: null },
    board: Array(9).fill(""),
    currentPlayer: "X",
    active: false,
  };

  games.set(gameId, game);
  ws.gameId = gameId;
  ws.player = "X";

  // ارسال تایید ایجاد بازی
  ws.send(
    JSON.stringify({
      type: "game_created",
      gameId: gameId,
      player: "X",
    })
  );

  console.log(`بازی ${gameId} ایجاد شد`);
}

function joinGame(ws, gameId) {
  const game = games.get(gameId);

  if (!game) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "بازی یافت نشد",
      })
    );
    return;
  }

  if (game.players.O) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "بازی پر است",
      })
    );
    return;
  }

  // اتصال بازیکن دوم
  game.players.O = ws;
  game.active = true;
  ws.gameId = gameId;
  ws.player = "O";

  // اطلاع‌رسانی به هر دو بازیکن
  const startMessage = {
    type: "game_started",
    board: game.board,
    currentPlayer: game.currentPlayer,
  };

  game.players.X.send(
    JSON.stringify({
      ...startMessage,
      player: "X",
    })
  );

  game.players.O.send(
    JSON.stringify({
      ...startMessage,
      player: "O",
    })
  );

  console.log(`بازیکن دوم به بازی ${gameId} پیوست`);
}

function makeMove(ws, data) {
  const game = games.get(ws.gameId);

  if (!game || !game.active) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "بازی فعال نیست",
      })
    );
    return;
  }

  // بررسی نوبت
  if (ws.player !== game.currentPlayer) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "نوبت شما نیست",
      })
    );
    return;
  }

  // بررسی خانه خالی
  if (game.board[data.index] !== "") {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "خانه پر است",
      })
    );
    return;
  }

  // انجام حرکت
  game.board[data.index] = game.currentPlayer;

  // بررسی برنده
  const winner = checkWinner(game.board);
  const isDraw = game.board.every((cell) => cell !== "") && !winner;

  if (winner || isDraw) {
    game.active = false;
  } else {
    // تغییر نوبت
    game.currentPlayer = game.currentPlayer === "X" ? "O" : "X";
  }

  // ارسال به هر دو بازیکن
  const moveMessage = {
    type: "move_made",
    index: data.index,
    player: ws.player,
    board: game.board,
    currentPlayer: game.currentPlayer,
    winner: winner,
    isDraw: isDraw,
  };

  if (game.players.X) {
    game.players.X.send(JSON.stringify(moveMessage));
  }
  if (game.players.O) {
    game.players.O.send(JSON.stringify(moveMessage));
  }
}

function resetGame(ws) {
  const game = games.get(ws.gameId);

  if (!game) return;

  // ریست بازی
  game.board = Array(9).fill("");
  game.currentPlayer = "X";
  game.active = true;

  // اطلاع‌رسانی به هر دو بازیکن
  const resetMessage = {
    type: "game_reset",
    board: game.board,
    currentPlayer: game.currentPlayer,
  };

  if (game.players.X) {
    game.players.X.send(JSON.stringify(resetMessage));
  }
  if (game.players.O) {
    game.players.O.send(JSON.stringify(resetMessage));
  }
}

function handleDisconnect(ws) {
  if (ws.gameId) {
    const game = games.get(ws.gameId);
    if (game) {
      // اطلاع‌رسانی به بازیکن دیگر
      const otherPlayer = ws.player === "X" ? game.players.O : game.players.X;
      if (otherPlayer) {
        otherPlayer.send(
          JSON.stringify({
            type: "player_disconnected",
          })
        );
      }

      // حذف بازی
      games.delete(ws.gameId);
      console.log(`بازی ${ws.gameId} حذف شد`);
    }
  }
}

function checkWinner(board) {
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
      return board[a];
    }
  }

  return null;
}

// شروع سرور
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`سرور روی پورت ${PORT} شروع شد`);
  console.log(`برای دسترسی به بازی: http://localhost:${PORT}`);
});

// مدیریت خطاها
process.on("uncaughtException", (error) => {
  console.error("خطای غیرمنتظره:", error);
});

process.on("unhandledRejection", (error) => {
  console.error("Promise رد شده:", error);
});
