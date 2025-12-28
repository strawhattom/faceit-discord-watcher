export interface Match {
    match_id: string;
    game_id: string;
    region: string;
    match_type: string;
    game_mode: string;
    max_players: number;
    teams_size: number;
    teams: any // TODO;
    // bunch of others properties to document...
}

interface DetailedResult {
    asc_score: boolean;
    /**
     * Faction Id
     */
    winner: string;
    factions: {
        [factionId: string]: {
            score: number;
        }
    }
}

interface FactionMember {
    player_id:string;
    /** Faceit name */
    nickname: string;
    /** Avatar URL */
    avatar: string;
    /** Membership */
    membership: "free" | "super_match_token" | "premium";
    /** Game player id */
    game_player_id: string
    /** Game player name */
    game_player_name: string;
    /** Faceit Level */
    game_skill_level: number;
    anticheat_required: boolean;
}

interface FactionStatistics {
    winProbability: float;
    skillLevel: {
        average: number;
        range: {
            min: number,
            max: number,
        }
        rating: number;
    }
}

interface TeamFaction {
    /**
     * Faction Id (usually `leader`)
     */
    faction_id: string;
    /**
     * Name of the team usually `team_` + leader name
     */
    name: string;
    /**
     * Leader Id
     */
    leader: string;
    /**
     * Leader avatar
     */
    avatar: string;
    roster: FactionMember[];
    stats: FactionStatistics;
    substituted: boolean;
    type: string;
}

export interface MatchDetail {
    match_id: string;
    region: string;
    game: string;
    voting: {
        map?: {
            entities: MapEntity[],
            picked: MapEntity
        },
        location?: any // TODO,
        voted_entity_types: Set<VotedEntityTypes>
    },
    teams: {
        [factionId: string]: TeamFaction,
    };
    results: {
        /**
         * Faction winner
         */
        winner: string;
        /**
         * Score detail 
         * FactionId => Score (number)
         */
        score: {
            [factionId: string]: number;
        }
    },
    detailed_results: DetailedResult
}

export interface MapEntity {
    guid: string;
    image_lg: string;
    image_sm: string;
    name: string;
    class_name: string;
    game_map_id: string;
}

export type VotedEntityTypes = "location" | "map"