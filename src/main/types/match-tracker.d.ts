
export interface State {
    users: {
        [playerId: string]: {
            lastMatchId?: string,
            lastElo?: number,
            nickname?: string
        }
    },
    lastCheck: string | null
}