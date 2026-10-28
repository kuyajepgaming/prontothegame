# Pronto The Game — Online Edition

Browser-based game using **Node.js, Express and Socket.IO**. Participants need only a browser. The server needs hosting.

## Run locally (for testing)

1. Install Node.js 20 or later on the computer running the server.
2. Extract this ZIP, open a terminal in the `Pronto_Online_Game` folder and run `npm install`.
3. Run `npm start`.
4. Open `http://localhost:3000` in your browser and click **Create Host Session**.
5. Copy **Join Link** to invite players; use **Display Link** for your projector or screenshare.

`localhost` links are only usable on the host computer. Deploy first for remote players.

## Deploy online (Render example)

1. Upload the extracted folder to your private GitHub repository.
2. In Render, create a **New Web Service** connected to that repository.
3. Runtime: **Node**. Build command: `npm install`. Start command: `npm start`.
4. Deploy and visit the public HTTPS URL.
5. Create a session. Share the join URL, **never the host URL** (it includes your private host token).

Set service to a continuously running instance for uninterrupted games; free services may sleep and can reset active rooms. Render/Railway/Fly.io or similar Node hosts with WebSocket support will work.

## Game flow

- Host creates a room and gets an 8-character room code.
- Players open `/join/ROOMCODE`, type their name and enter the waiting pool.
- Host sees all players and can assign each to Team 1 / Team 2, or **Randomly Assign Pool**.
- Host can open the existing Team Creator to move or select a player.
- Host controls game questions, scoring, title screen, strikes and reveals.
- Online Player Display URL updates in real time. Players can watch via the **Open game display** link.

## Notes

- Rooms and rosters are stored **in server memory**, so restarting the server clears sessions.
- Reconnecting players are recognized within the same browser profile using a locally stored player ID.
- Anyone with the player link may join. Host token is required for editing and should be kept private.
- Player view is a presentation screen and receives complete game-state data; it is not designed to prevent technically skilled participants from inspecting unrevealed answers. For competitive anti-cheat, a server-side redacted display model would be a future improvement.
- The large embedded assets (two provided images, background music MP3, strike buzzer) are included within `public/game.html` so they work after deployment.
- Chrome may require one click on the Player View to enable background music/sound effects.
