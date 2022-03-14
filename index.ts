import express from 'express';
import http from 'http';

import dotenv from 'dotenv';
import path from 'path';

import SocketIO from 'socket.io';

type Item = string | null;

// Active games & current game ID
const games = new Map<
  number,
  {
    id: number;
    players: string[];
    started: boolean;
    turn: string;
    board: [[Item, Item, Item], [Item, Item, Item], [Item, Item, Item]];
  }
>();
let currentGameIdentifier = 0;

const colors = {
  0: 'red',
  1: 'green',
};

// Config dotenv
dotenv.config({ path: '.env.local' });

// Init express app
const app: express.Application = express();
const server = http.createServer(app);
const PORT = process.env.PORT;

// Use public folder
app.use(express.static(path.resolve('./public')));

// Use ejs templating engine
app.set('view engine', 'ejs');

// Init socketio websockets
const io = new SocketIO.Server(server);

// On user connection...
io.sockets.on('connection', (socket) => {
  // Connection log
  console.log('\x1b[33m%s\x1b[0m', '[Websockets]', `Connect - ${socket.id}`);

  // On 'leave' socket
  // This will remove the player from a room
  socket.on('leave', (data: { room: string }) => {
    socket.leave(data.room);
  });

  // On 'play' socket
  // This allows the board to be populated
  socket.on('play', (data: { room: string; row: string; col: string }) => {
    let game = games.get(parseInt(data.room));
    if (!game || !game.started) return;

    const cell = game.board[parseInt(data.row)][parseInt(data.col)];
    const color = colors[game.players.indexOf(socket.id) as 0 | 1];

    if (socket.rooms.has(data.room) && game.turn === color && cell == null) {
      // Set the cell's color to the player's color
      game.board[parseInt(data.row)][parseInt(data.col)] = color;

      // Insert the new data into the board
      games.set(game.id, game);
      game = games.get(game.id)!;

      // Check if the game has been won
      let won = false;
      let winner;
      for (let x = 0; x < game.board.length; x++) {
        const row = game.board[x];
        if (row[0] === color && row[1] === color && row[2] === color)
          won = true;
        for (let y = 0; y < game.board.length; y++) {
          if (
            game.board[0][y] === color &&
            game.board[1][y] === color &&
            game.board[2][y] === color
          )
            won = true;
        }
      }
      if (
        game.board[0][0] === color &&
        game.board[1][1] === color &&
        game.board[2][2] === color
      )
        won = true;
      if (
        game.board[0][2] === color &&
        game.board[1][1] === color &&
        game.board[2][0] === color
      )
        won = true;

      // Check if the game is a tie
      let tie = true;
      game.board.forEach((row) => {
        row.forEach((cell) => {
          if (cell == null) tie = false;
        });
      });

      if (won) tie = false;
      if (won) winner = game.turn;

      // Switch up whose turn it is
      if (game.turn === 'red') game.turn = 'green';
      else game.turn = 'red';

      // Update game
      games.set(game.id, game);
      game = games.get(game.id)!;

      // Send a board update to all players
      io.to(data.room).emit('board_update', {
        board: game.board,
        turn: game.turn,
      });

      // Send a message to all players if the game has been won
      if (won)
        io.to(data.room).emit('game_won', {
          winner,
        });

      // Send a message to all players if the game is a tie
      if (tie) io.to(data.room).emit('game_tie');

      // Reset the board if the game is won or a tie
      if (won || tie) {
        games.set(game!.id, {
          id: game!.id,
          players: game!.players,
          started: true,
          turn: Math.random() < 0.5 ? 'red' : 'green',
          board: [
            [null, null, null],
            [null, null, null],
            [null, null, null],
          ],
        });
        game = games.get(game!.id)!;
        io.to(game.id.toString()).emit('board_update', {
          board: game.board,
          turn: game.turn,
        });
      }
    }
  });

  // On 'validate_room' socket
  // This socket allows a client to check if a room exists on the server
  socket.on('validate_room', (data: { id: number }) => {
    const exists = games.has(data.id);
    let full = false;

    // If the room exists...
    if (exists) {
      const room = games.get(data.id)!;

      if (room.players.length >= 2)
        return io.to(socket.id).emit('room_validated', {
          exists: true,
          full: true,
          started: false,
        });

      // If the user is already in the room, don't do anything
      // Don't join the room if it is already full
      if (room.players.length < 2 && !room.players.includes(socket.id)) {
        // Join the room
        socket.join(room.id.toString());

        let game = games.get(room.id)!;
        game.players.push(socket.id);

        // Update the room's players
        games.set(room.id, game);
        game = games.get(room.id)!;

        // Emit a room size update
        io.to(game.id.toString()).emit('count_updated', {
          count: game.players.length,
        });

        // If the size is full, emit a room ready message
        if (games.get(room.id)?.players.length === 2) {
          game.turn = Math.random() < 0.5 ? 'red' : 'green';
          game.started = true;
          games.set(room.id, game);

          game = games.get(room.id)!;

          io.to(game.id.toString()).emit('ready');

          game.players.forEach((player) => {
            io.to(player).emit('color_assign', {
              color: colors[game.players.indexOf(player) as 0 | 1],
            });
          });

          io.to(game.id.toString()).emit('board_update', {
            board: game.board,
            turn: game.turn,
          });
        }
      }
    }

    io.to(socket.id).emit('room_validated', {
      exists,
      full,
      started: games.get(data.id)?.started,
    });
  });

  // On 'create_room' socket
  // This sockets allows a client to create a game on the server
  socket.on('create_room', () => {
    // Create new game with player's ID
    games.set(currentGameIdentifier, {
      id: currentGameIdentifier,
      players: [socket.id],
      started: false,
      turn: '',
      board: [
        [null, null, null],
        [null, null, null],
        [null, null, null],
      ],
    });

    // Send response to client & add client to room
    io.to(socket.id).emit('room_created', { id: currentGameIdentifier });
    socket.join(currentGameIdentifier.toString());

    // Emit a room size update
    io.to(currentGameIdentifier.toString()).emit('count_updated', {
      count: 1,
    });

    console.log(
      '\x1b[33m%s\x1b[0m',
      '[Websockets]',
      `Created room - ${currentGameIdentifier}`
    );

    // Increment game identifier
    currentGameIdentifier++;
  });

  // On user disconnect
  socket.on('disconnect', () => {
    // Log user disconnect
    console.log(
      '\x1b[33m%s\x1b[0m',
      '[Websockets]',
      `Disconnect - ${socket.id}`
    );

    // Check if the user was in any games
    games.forEach((game, key) => {
      if (game.players.includes(socket.id)) {
        // Leave the room
        socket.leave(game.id.toString());

        // Make the other player leave the room
        io.to(game.id.toString()).emit('leave_order', {
          room: game.id.toString(),
        });

        // Delete the game
        games.delete(key);
        console.log(
          '\x1b[33m%s\x1b[0m',
          '[Websockets]',
          `Deleted room - ${key}`
        );
      }
    });
  });
});

// Home page
app.get('/', (_, res: any) => {
  res.render('index');
});

// Listen on PORT
server.listen(PORT, () => {
  console.log('\x1b[36m%s\x1b[0m', '[Express]', `Server running - *:${PORT}`);
});
