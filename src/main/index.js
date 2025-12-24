// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits } = require('discord.js');
const FaceitAPI = require('./faceit-api');
const MatchTracker = require('./match-tracker');
const MatchMonitor = require('./match-monitor');

// Load configuration
const config = require('../../config.json');

// Create Discord client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Initialize services
const faceitApi = new FaceitAPI(config.faceit_token);
const matchTracker = new MatchTracker('./data');
let matchMonitor = null;

// When the client is ready, initialize the match monitor
client.once(Events.ClientReady, async (readyClient) => {
	console.log(`Ready! Logged in as ${readyClient.user.tag}`);
	
	try {
		// Initialize tracker
		await matchTracker.initialize();
		
		// Get Discord channel
		const channelIds = config.discord_channel_ids;
		let discordChannels = null;
		
		if (channelIds) {
			discordChannels = await Promise.all(channelIds.map(id => client.channels.fetch(id)));
			console.log(`Discord channels set: ${discordChannels.map(d => d.name).join(",")}`);
		} else {
			console.warn('No discord_channel_id in config, notifications will be disabled');
		}
		
		// Initialize monitor
		matchMonitor = new MatchMonitor(faceitApi, matchTracker, discordChannels);
		
		// Register users from config
		if (config.faceit_users && Array.isArray(config.faceit_users)) {
			console.log(`Registering ${config.faceit_users.length} user(s)...`);
			for (const userIdentifier of config.faceit_users) {
				try {
					await registerUser(userIdentifier);
				} catch (error) {
					console.error(`Failed to register user "${userIdentifier}":`, error.message);
					// Continue with other users even if one fails
				}
			}
		} else {
			console.log('No users configured. Add "faceit_users" array to config.json');
		}
		
		// Start monitoring (poll every 60 seconds by default)
		const pollInterval = config.poll_interval_seconds ? config.poll_interval_seconds * 1000 : 60000;
		matchMonitor.start(pollInterval);
		
		console.log('Match monitor started successfully!');
	} catch (error) {
		console.error('Error initializing match monitor:', error);
		process.exit(1);
	}
});

/**
 * Register a user to track (by nickname or player ID)
 * @param {string} userIdentifier - FACEIT nickname or player ID
 */
async function registerUser(userIdentifier) {
	try {
		let playerId, nickname, currentElo;
		
		// Try to get user by nickname first, then by player ID
		let user = null;
		let nicknameError = null;
		
		try {
			user = await faceitApi.getUserByNickname(userIdentifier);
		} catch (error) {
			nicknameError = error;
		}
		
		// If not found by nickname, try as player ID
		if (!user) {
			try {
				user = await faceitApi.getUserById(userIdentifier);
			} catch (idError) {
				const errorMsg = nicknameError 
					? `User "${userIdentifier}" not found by nickname (${nicknameError.message}) or player ID (${idError.message})`
					: `User "${userIdentifier}" not found by player ID: ${idError.message}`;
				throw new Error(errorMsg);
			}
		}
		
		if (!user) {
			throw new Error(`Could not retrieve user data for "${userIdentifier}"`);
		}
		
		playerId = user.player_id;
		nickname = user.nickname;
		
		// Get current stats to know ELO
		const stats = await faceitApi.getPlayerStats(playerId);
		currentElo = extractElo(stats);
		
		// Get last match ID if available
		const matchHistory = await faceitApi.getMatchHistory(playerId, 1);
		const lastMatchId = matchHistory.items?.[0]?.match_id || null;
		
		// Register user
		await matchTracker.registerUser(playerId, nickname, currentElo, lastMatchId);
		
		console.log(`✓ Registered: ${nickname} (${playerId}) - ELO: ${currentElo}`);
	} catch (error) {
		console.error(`Error registering user "${userIdentifier}":`, error);
		throw error;
	}
}

/**
 * Extract ELO from stats object
 */
function extractElo(stats) {
    if (stats?.games?.cs2?.faceit_elo) {
        return Number.parseInt(stats.games.cs2.faceit_elo, 10);
    }
	if (stats?.lifetime?.Elo) {
		return Number.parseInt(stats.lifetime.Elo, 10);
	}
	if (stats?.segments?.[0]?.stats?.Elo) {
		return Number.parseInt(stats.segments[0].stats.Elo, 10);
	}
	if (stats?.faceit_elo) {
		return Number.parseInt(stats.faceit_elo, 10);
	}
	return 0;
}

// Handle graceful shutdown
process.on('SIGINT', () => {
	console.log('\nShutting down...');
	if (matchMonitor) {
		matchMonitor.stop();
	}
	process.exit(0);
});

// Log in to Discord with your client's token
client.login(config.discord_token);