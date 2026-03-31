# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real-time multiplayer Texas Hold'em poker game with a React frontend and Node.js/Socket.IO backend.

## Commands

```bash
# Install all dependencies
npm run install:all

# Run both client and server concurrently
npm run dev

# Run individually
npm run dev --prefix server   # Server on port 3001
npm run dev --prefix client   # Client on port 5173

# Run server tests
cd server && npm run test
```

## Architecture

### Backend (server/src/)
- **index.js**: Express + Socket.IO server entry, handles WebSocket connections and room events
- **game/Deck.js**: Card deck management (shuffle, deal)
- **game/HandEvaluator.js**: Evaluates poker hands (7-card combination selector)
- **game/GameRoom.js**: Single game state machine - controls game phases, betting rounds, and win determination
- **game/RoomManager.js**: Manages multiple game rooms

### Frontend (client/src/)
- **App.jsx**: Main component, switches between Lobby and Table
- **hooks/useSocket.js**: Socket.IO connection management
- **hooks/useGame.js**: Game state subscription and action methods
- **components/Lobby.jsx**: Room creation/joining UI
- **components/Table.jsx**: Main game table with community cards
- **components/PlayerSeat.jsx**: Individual player display
- **components/ActionPanel.jsx**: Player action buttons (check, call, raise, fold, allin)

### Communication
Client-server communication via Socket.IO events:
- `room:create`, `room:join` - Room management
- `game:start` - Start game
- `action:check`, `action:call`, `action:raise`, `action:fold`, `action:allin` - Player actions
- `game:state` - Server broadcasts game state (authoritative)

## Game Phases

```
WAITING → PREFLOP → FLOP → TURN → RIVER → SHOWDOWN → WAITING
```

- **WAITING**: Waiting for players to join
- **PREFLOP**: Deal hole cards (2 each), post blinds, first betting round
- **FLOP**: Deal 3 community cards, second betting round
- **TURN**: Deal 4th community card, third betting round
- **RIVER**: Deal 5th community card, final betting round
- **SHOWDOWN**: Evaluate hands, declare winner, distribute pot

## Constants

- Small blind: 2
- Big blind: 4
- Starting chips: 400
- Max players: 9

## Testing

Server tests use Jest with ESM support. Test files located in `server/src/game/*.test.js`.
