const axios = require('axios');

class FaceitAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseURL = 'https://open.faceit.com/data/v4';
        this.headers = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Get user by nickname
     * @param {string} nickname - FACEIT nickname
     * @returns {Promise<Object>} User data including player_id
     */
    async getUserByNickname(nickname) {
        try {
            const response = await axios.get(`${this.baseURL}/players`, {
                headers: this.headers,
                params: { nickname }
            });
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                throw new Error(`User "${nickname}" not found`);
            }
            console.error(`Error fetching user by nickname "${nickname}":`, error.message);
            throw error;
        }
    }

    /**
     * Get user by player ID
     * @param {string} playerId - FACEIT player ID
     * @returns {Promise<Object>} User data
     */
    async getUserById(playerId) {
        try {
            const response = await axios.get(`${this.baseURL}/players/${playerId}`, {
                headers: this.headers
            });
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                throw new Error(`Player ID "${playerId}" not found`);
            }
            console.error(`Error fetching user by ID "${playerId}":`, error.message);
            throw error;
        }
    }

    /**
     * Get user's match history
     * @param {string} playerId - FACEIT player ID
     * @param {number} limit - Number of matches to retrieve (default: 20)
     * @param {number} offset - Offset for pagination (default: 0)
     * @returns {Promise<Object>} Match history
     */
    async getMatchHistory(playerId, limit = 20, offset = 0) {
        try {
            const response = await axios.get(`${this.baseURL}/players/${playerId}/history`, {
                headers: this.headers,
                params: {
                    game: 'cs2', // or 'csgo' depending on the game
                    limit,
                    offset
                }
            });
            return response.data;
        } catch (error) {
            console.error(`Error fetching match history for player "${playerId}":`, error.message);
            throw error;
        }
    }

    /**
     * Get user's CS2 stats
     * @param {string} playerId - FACEIT player ID
     * @returns {Promise<Object>} User stats including ELO
     */
    async getPlayerStats(playerId) {
        try {
            const response = await axios.get(`${this.baseURL}/players/${playerId}`, {
                headers: this.headers
            });
            return response.data;
        } catch (error) {
            console.error(`Error fetching player stats for "${playerId}":`, error.message);
            throw error;
        }
    }

    /**
     * Get match details
     * @param {string} matchId - FACEIT match ID
     * @returns {Promise<Object>} Match details
     */
    async getMatchDetails(matchId) {
        try {
            const response = await axios.get(`${this.baseURL}/matches/${matchId}`, {
                headers: this.headers
            });
            return response.data;
        } catch (error) {
            console.error(`Error fetching match details for "${matchId}":`, error.message);
            throw error;
        }
    }
}

module.exports = FaceitAPI;

