const fs = require('node:fs').promises;
const path = require('node:path');

class MatchTracker {

    /**
     * @type {import("./types/match-tracker").State}
     */
    state;

    constructor(dataDir = './data') {
        this.dataDir = dataDir;
        this.stateFile = path.join(dataDir, 'tracker-state.json');
        this.state = {
            users: {}, // playerId -> { lastMatchId, lastElo, nickname }
            lastCheck: null
        };
    }

    /**
     * Initialize tracker - load existing state
     */
    async initialize() {
        try {
            // Ensure data directory exists
            await fs.mkdir(this.dataDir, { recursive: true });
            
            // Load existing state if it exists
            try {
                const data = await fs.readFile(this.stateFile, 'utf8');
                this.state = JSON.parse(data);
            } catch (error) {
                // File doesn't exist, start fresh
                if (error.code === 'ENOENT') {
                    console.log('No existing state found, starting fresh');
                } else {
                    console.error('Error reading state file:', error.message);
                    throw error;
                }
            }
        } catch (error) {
            console.error('Error initializing tracker:', error);
            throw error;
        }
    }

    /**
     * Save current state to disk
     */
    async saveState() {
        try {
            await fs.writeFile(this.stateFile, JSON.stringify(this.state, null, 2));
        } catch (error) {
            console.error('Error saving state:', error);
            throw error;
        }
    }

    /**
     * Register a user to track
     * @param {string} playerId - FACEIT player ID
     * @param {string} nickname - FACEIT nickname
     * @param {number} currentElo - Current ELO
     * @param {string} lastMatchId - Last known match ID (optional)
     */
    async registerUser(playerId, nickname, currentElo, lastMatchId = null) {
        if (this.state.users[playerId]) {
            // Update existing user info
            this.state.users[playerId].nickname = nickname;
            // Only update lastElo if user doesn't have a tracked match yet
            // This preserves the ELO from before the last tracked match
            if (currentElo !== undefined && !this.state.users[playerId].lastMatchId) {
                this.state.users[playerId].lastElo = currentElo;
            }
            // Update lastMatchId if provided and different
            if (lastMatchId && this.state.users[playerId].lastMatchId !== lastMatchId) {
                this.state.users[playerId].lastMatchId = lastMatchId;
            }
        } else {
            this.state.users[playerId] = {
                nickname,
                lastMatchId: lastMatchId,
                lastElo: currentElo,
                registeredAt: new Date().toISOString()
            };
            console.log(`Registered user: ${nickname} (${playerId})`);
        }
        await this.saveState();
    }

    /**
     * Get all tracked users
     * @returns {Object} Map of playerId -> user info
     */
    getTrackedUsers() {
        return this.state.users;
    }

    /**
     * Check if a match is new for a user
     * @param {string} playerId - FACEIT player ID
     * @param {string} matchId - Match ID to check
     * @returns {boolean} True if match is new
     */
    isNewMatch(playerId, matchId) {
        const user = this.state.users[playerId];
        if (!user) return false;
        return user.lastMatchId !== matchId;
    }

    /**
     * Update user's last match and ELO
     * @param {string} playerId - FACEIT player ID
     * @param {string} matchId - Match ID
     * @param {number} newElo - New ELO after match
     */
    async updateUserMatch(playerId, matchId, newElo) {
        if (this.state.users[playerId]) {
            const oldElo = this.state.users[playerId].lastElo;
            this.state.users[playerId].lastMatchId = matchId;
            this.state.users[playerId].lastElo = newElo;
            await this.saveState();
            return oldElo;
        }
        return null;
    }

    /**
     * Remove a user from tracking
     * @param {string} playerId - FACEIT player ID
     */
    async removeUser(playerId) {
        if (this.state.users[playerId]) {
            delete this.state.users[playerId];
            await this.saveState();
            console.log(`Removed user: ${playerId}`);
        }
    }

    /**
     * Update last check timestamp
     */
    async updateLastCheck() {
        this.state.lastCheck = new Date().toISOString();
        await this.saveState();
    }
}

module.exports = MatchTracker;

