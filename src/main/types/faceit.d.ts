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
    teams: any;
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