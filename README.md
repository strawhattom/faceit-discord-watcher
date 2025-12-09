# FACEIT Discord Watcher

A Node.js bot that monitors FACEIT users' matches and sends Discord notifications when they play matches, including ELO changes.

## Features

- ✅ Monitor multiple FACEIT users dynamically
- ✅ Track match results (Win/Loss)
- ✅ Calculate and display ELO changes
- ✅ Send Discord notifications with match details
- ✅ Persistent state tracking (survives restarts)
- ✅ Configurable polling interval

## How It Works

Since FACEIT doesn't provide webhooks, this bot uses **polling** to check for new matches:
- Polls the FACEIT API at configurable intervals (default: 60 seconds)
- Compares current matches with last known match
- Calculates ELO changes by comparing before/after values
- Sends Discord notifications for new matches

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure

Copy `config.example.json` to `config.json` and fill in your values:

```json
{
    "faceit_token": "your-faceit-api-token",
    "discord_token": "your-discord-bot-token",
    "discord_channel_id": "your-discord-channel-id",
    "poll_interval_seconds": 60,
    "faceit_users": [
        "nickname1",
        "nickname2"
    ]
}
```

**Configuration Fields:**
- `faceit_token`: Your FACEIT API token (get from [FACEIT Developer Portal](https://developers.faceit.com/))
- `discord_token`: Discord bot token (create a bot at [Discord Developer Portal](https://discord.com/developers/applications))
- `discord_channel_id`: Discord channel ID where notifications will be sent
- `poll_interval_seconds`: How often to check for new matches (in seconds, default: 60)
- `faceit_users`: Array of FACEIT nicknames or player IDs to monitor

### 3. Get Discord Channel ID

1. Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)
2. Right-click on the channel where you want notifications
3. Click "Copy ID"

### 4. Run the Bot

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

## Adding/Removing Users

### Adding Users

Add FACEIT nicknames or player IDs to the `faceit_users` array in `config.json`:

```json
{
    "faceit_users": [
        "new-user-nickname",
        "another-player-id"
    ]
}
```

Restart the bot to register new users.

### Removing Users

Remove the user from `config.json` and restart the bot. The user's tracking data will remain in `data/tracker-state.json` but won't be monitored.

To completely remove a user, delete their entry from `data/tracker-state.json`.

## How ELO Tracking Works

1. When a user is registered, the bot records their current ELO
2. On each poll, the bot checks for new matches
3. When a new match is detected:
   - Gets the user's current ELO (after the match)
   - Compares with the last known ELO (before the match)
   - Calculates the difference
   - Sends a Discord notification

## Discord Notifications

Notifications include:
- ✅/❌ Win/Loss indicator
- ELO before and after the match
- ELO change (e.g., +25 or -15)
- Match ID, timestamp and map
- Link to the match on FACEIT

## Data Storage

The bot stores tracking state in `data/tracker-state.json`:
- Last known match ID for each user
- Last known ELO for each user
- Registration timestamps

This allows the bot to:
- Resume tracking after restarts
- Only notify about new matches
- Calculate accurate ELO changes

## Rate Limits

The bot includes delays between API calls to respect FACEIT's rate limits. If you encounter rate limit errors:
- Increase `poll_interval_seconds` in config
- Reduce the number of users being tracked
- Check FACEIT API documentation for current rate limits

## Troubleshooting

### "User not found" errors
- Verify the FACEIT nickname is correct
- Check if the user exists on FACEIT
- Try using the player ID instead of nickname

### Discord notifications not working
- Verify `discord_channel_id` is correct
- Ensure the bot has permission to send messages in the channel
- Check that the bot is in the Discord server

### No matches detected
- Users may not have played matches recently
- Check `data/tracker-state.json` to see last known matches
- Verify the FACEIT API token is valid

## License

MIT


