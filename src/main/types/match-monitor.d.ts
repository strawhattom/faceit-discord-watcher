export interface UserResult {
    nickname: string;
    oldElo: number;
    currentElo: number;
    eloChange?: number;
    won: boolean;
    userDetail: any;
    /**
     * User faction.
     */
    faction: "faction1" | "faction2" | string;
}