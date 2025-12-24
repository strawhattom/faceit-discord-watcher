const FaceitAPI = require('./faceit-api');
const MatchTracker = require('./match-tracker');

/**
 * @import { UserResult, MatchDetail } from "./types/match-monitor"
 */

class MatchMonitor {

    /** @type {FaceitAPI} */
    faceitApi
    /** @type {MatchTracker}*/
    matchTracker
    /**@type {string[]} */
    discordChannels
    /** @type {number} */
    pollInterval
    /** @type {number} */
    pollIntervalMs
    /** @type {boolean} */
    first

    constructor(faceitApi, matchTracker, discordChannels) {
        this.faceitApi = faceitApi;
        this.matchTracker = matchTracker;
        this.discordChannels = discordChannels;
        this.pollInterval = null;
        this.pollIntervalMs = 60000; // 1 minute default
        this.first = true; // First initial check
    }

    /**
     * Start monitoring matches
     * @param {number} intervalMs - Polling interval in milliseconds
     */
    start(intervalMs = 60000) {
        this.pollIntervalMs = intervalMs;
        console.log(`Starting match monitor (polling every ${intervalMs / 1000}s)`);
        // Initial check
        this.checkMatches();
        
        // Set up polling
        this.pollInterval = setInterval(() => {
            this.checkMatches();
        }, intervalMs);
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
            console.log('Match monitor stopped');
        }
    }

    /**
     * Check for new matches for all tracked users
     */
    async checkMatches() {
        try {
            const trackedUsers = this.matchTracker.getTrackedUsers();
            const userIds = Object.keys(trackedUsers);

            if (!userIds?.length) {
                console.log('No users to track');
                return;
            }

            // Step 1: For each tracked user, check latest match and collect users with new matches
            const usersWithNewMatches = [];
            
            for (const playerId of userIds) {
                try {
                    const userInfo = trackedUsers[playerId];
                    if (!userInfo) continue;

                    // Get recent matches
                    const matchHistory = await this.faceitApi.getMatchHistory(playerId, 5);
                    const matches = matchHistory.items || [];

                    if (matches.length === 0) {
                        continue;
                    }

                    // Get current stats to know current ELO
                    const stats = await this.faceitApi.getPlayerStats(playerId);
                    const currentElo = this.extractElo(stats);

                    // Check the most recent match
                    const latestMatch = matches[0];
                    const matchId = latestMatch.match_id;

                    // If this is a new match, collect this user
                    // IMPORTANT: Capture lastElo BEFORE any updates to preserve the ELO from before the match
                    if (this.matchTracker.isNewMatch(playerId, matchId)) {
                        usersWithNewMatches.push({
                            playerId,
                            userInfo,
                            match: latestMatch,
                            matchId,
                            currentElo,
                            lastElo: userInfo.lastElo || currentElo // Use saved lastElo, fallback to currentElo if not set
                        });
                    }

                    // Small delay to respect rate limits
                    await this.sleep(500);
                } catch (error) {
                    console.error(`Error checking matches for user ${playerId}:`, error.message);
                }
            }

            if (usersWithNewMatches.length === 0) {
                await this.matchTracker.updateLastCheck();
                return;
            }

            // Step 2: Group users by matchId (to prevent spam and duplicate API calls)
            const usersByMatch = {};
            for (const userData of usersWithNewMatches) {
                const matchId = userData.matchId;
                if (!usersByMatch[matchId]) {
                    usersByMatch[matchId] = [];
                }
                usersByMatch[matchId].push(userData);
            }

            // Step 3: For each group, fetch match details once and process all users
            for (const [matchId, usersInMatch] of Object.entries(usersByMatch)) {
                try {
                    // Fetch match details once for all users in this match
                    const matchDetails = await this.faceitApi.getMatchDetails(matchId);
                    
                    // Process each user in this match and collect results
                    const userResults = [];
                    for (const userData of usersInMatch) {
                        const result = await this.processNewMatch(
                            userData.playerId,
                            userData.match,
                            userData.currentElo,
                            userData.userInfo,
                            matchDetails,
                            userData.lastElo // Pass the captured lastElo from before the match
                        );
                        if (result) {
                            userResults.push(result);
                        }
                    }

                    // Send one Discord notification for the entire match group
                    if (this.discordChannels && userResults.length > 0) {
                        await this.sendGroupedDiscordNotification(
                            usersInMatch[0].match,
                            matchDetails,
                            userResults,
                        );
                    }

                    // Small delay between matches
                    await this.sleep(500);
                } catch (error) {
                    console.error(`Error processing match ${matchId}:`, error.message);
                }
            }

            await this.matchTracker.updateLastCheck();
            
            if (this.first) {
                this.first = false;
            }
        } catch (error) {
            console.error('Error in checkMatches:', error);
        }
    }

    /**
     * Check for new matches for a specific user
     * @param {string} playerId - FACEIT player ID
     */
    async checkUserMatches(playerId) {
        try {
            // Get recent matches
            const matchHistory = await this.faceitApi.getMatchHistory(playerId, 5);
            const matches = matchHistory.items || [];

            if (matches.length === 0) {
                return;
            }

            // Get current stats to know current ELO
            const stats = await this.faceitApi.getPlayerStats(playerId);
            const currentElo = this.extractElo(stats);

            const userInfo = this.matchTracker.getTrackedUsers()[playerId];
            if (!userInfo) return;

            // Check the most recent match
            const latestMatch = matches[0];
            const matchId = latestMatch.match_id;

            // If this is a new match, process it
            if (this.matchTracker.isNewMatch(playerId, matchId)) {
                this.processNewMatch(playerId, latestMatch, currentElo, userInfo);
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Process a new match and calculate ELO change
     * @param {string} playerId - FACEIT player ID
     * @param {Object} match - Match data
     * @param {number} currentElo - Current ELO after match
     * @param {Object} userInfo - User tracking info
     * @param {MatchDetail} [matchDetails] - Optional pre-fetched match details
     * @param {number} [lastElo] - Optional last ELO before the match (to preserve ELO from before check)
     * @returns {UserResult|null} User match result data or null if error
     */
    async processNewMatch(playerId, match, currentElo, userInfo, matchDetails = null, lastElo = null) {
        try {
            // Get detailed match info if not provided
            if (!matchDetails) {
                matchDetails = await this.faceitApi.getMatchDetails(match.match_id);
            }

            // Find the player in the match
            const playerInMatch = this.findPlayerInMatch(matchDetails, playerId);
            
            if (!playerInMatch) {
                console.log(`Could not find player ${playerId} in match ${match.match_id}`);
                return null;
            }

            // Use provided lastElo if available, otherwise fall back to userInfo.lastElo
            // This preserves the ELO from before the match was detected
            const oldElo = lastElo ?? (userInfo.lastElo || currentElo);
            const eloChange = currentElo - oldElo;

            // Get the user faction to determine if he won or not.
            const userFaction = Object.keys(matchDetails.teams).find(factionId => matchDetails.teams[factionId].roster.find(player => player.player_id === playerId))
            const won = matchDetails.results.winner === userFaction; // The player won if the result winner is the current player's faction.

            // Update tracker
            await this.matchTracker.updateUserMatch(playerId, match.match_id, currentElo);

            console.log(`New match for ${userInfo.nickname}: ${won ? 'WON' : 'LOST'} | ELO: ${oldElo} → ${currentElo} (${eloChange > 0 ? '+' : ''}${eloChange})`);

            // Return user match result data (Discord notification will be sent per group)
            return {
                nickname: userInfo.nickname,
                oldElo,
                currentElo,
                eloChange,
                won
            };
        } catch (error) {
            console.error(`Error processing match for ${playerId}:`, error);
            return null;
        }
    }

    /**
     * Find player data in match details
     * @param {Object} matchDetails - Full match details
     * @param {string} playerId - Player ID to find
     * @returns {Object|null} Player data or null
     */
    findPlayerInMatch(matchDetails, playerId) {
        // Check both teams
        const teams = matchDetails.teams || {};
        for (const team of Object.values(teams)) {
            const players = team.roster || [];
            const player = players.find(p => p.player_id === playerId);
            if (player) return player;
        }
        return null;
    }

    /**
     * Extract ELO from stats object
     * @param {Object} stats - Player stats
     * @returns {number} Current ELO
     */
    extractElo(stats) {

        // ELO is typically in stats.lifetime or stats.segments[0].stats
        if (stats?.games?.cs2?.faceit_elo) {
            return Number.parseInt(stats.games.cs2.faceit_elo, 10);
        }
        if (stats?.lifetime?.Elo) {
            return Number.parseInt(stats.lifetime.Elo, 10);
        }
        if (stats?.segments?.[0]?.stats?.Elo) {
            return Number.parseInt(stats.segments[0].stats.Elo, 10);
        }
        // Fallback: try to get from faceit_elo
        if (stats?.faceit_elo) {
            return Number.parseInt(stats.faceit_elo, 10);
        }
        return 0;
    }

    /**
     * 
     * @param {UserResult} result       User result object with {nickname, oldElo, currentElo, eloChange, won}
     * @returns {string}
     */
    #getUserInlineDetail(result) {
        const eloChangeStr = result.eloChange > 0 ? `+${result.eloChange}` : `${result.eloChange}`;
        const emoji = result.eloChange > 0 
            ? '📈' 
            : result.eloChange === 0 
                ? '🎯' 
                : '📉 ';
        const message = `${emoji} **${result.nickname}**: ${result.oldElo} → ${result.currentElo} (${eloChangeStr})`
        return message;
    }

    /**
     * Send grouped Discord notification for multiple users in the same match
     * @param {Object} match - Match data
     * @param {Object} matchDetails - Match details
     * @param {Array} userResults - Array of user result objects with {nickname, oldElo, currentElo, eloChange, won}
    */
    async sendGroupedDiscordNotification(match, matchDetails, userResults) {
        try {
            if (!userResults || userResults.length === 0) {
                return;
            }

            // Determine overall color based on results (green if at least one win, red if all lost)
            const hasWin = userResults.some(r => r.won);
            const color = hasWin ? 0x00ff00 : 0xff0000;

            // Build description with all users
            const userDescriptions = userResults.map(r => this.#getUserInlineDetail(r));

            const trackedPlayersLabel = `${userResults.length} tracked player${userResults.length > 1 ? 's' : ''}`
            const embedMainTitle = this.first ? `Keeping track of latest matches for ${trackedPlayersLabel}` : `New latest match results (${trackedPlayersLabel})`

            const embed = {
                title: `🎮 Faceit - ${embedMainTitle}`,
                description: userDescriptions.join('\n'),
                color: color,
                fields: [
                    {
                        name: this.first ? 'Last Match ID' : 'Match ID',
                        value: match.match_id,
                        inline: true
                    },
                    {
                        name: 'Started',
                        value: new Date(match.started_at * 1000).toLocaleString(),
                        inline: true
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'FACEIT Discord watcher'
                }
            };

            // Add match link if available
            if (match.match_id) {
                embed.url = `https://www.faceit.com/en/cs2/room/${match.match_id}`;
            }

            // Add match map pick
            if (matchDetails?.voting?.map?.pick?.length === 1) {
                const mapId = matchDetails.voting.map.pick[0]
                const mapDetail = matchDetails.voting.map.entities.find(map => map.guid === mapId);
                embed.fields.push({
                    name: "Map",
                    value: mapDetail.name
                })

                // Add map as thumbnail
                embed.thumbnail = {
                    url: mapDetail.image_lg
                }
            }

            await Promise.all(this.discordChannels.map(discordChannel => discordChannel.send({ embeds: [embed] })));
        } catch (error) {
            console.error('Error sending grouped Discord notification:', error);
        }
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = MatchMonitor;

