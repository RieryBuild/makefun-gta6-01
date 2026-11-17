// SOLMAR BAY — shared tuning and layout constants.
// One job: every magic number the rest of the game agrees on lives here,
// so the city, the traffic, the police and the missions all share one map.

// ---- City layout (all distances in metres, origin at the city centre) ----
export const ROAD_SPACING = 48;   // distance between parallel road centrelines
export const ROAD_WIDTH = 14;     // asphalt width of every street
export const BLOCK_MIN = -4;      // block indices run BLOCK_MIN .. BLOCK_MAX
export const BLOCK_MAX = 3;       // 8 x 8 blocks, city spans -192 .. 192
export const CITY_EDGE = 192;     // half-width of the built-up city
export const WORLD_EDGE = 330;    // half-width of the ground + water planes
export const ROAD_LINES = [-144, -96, -48, 0, 48, 96, 144]; // road centrelines

// Block (bx, bz) spans x in [bx*48+7, (bx+1)*48-7]; its centre is bx*48+24.
export function blockCentre(bx, bz) {
  return { x: bx * ROAD_SPACING + ROAD_SPACING / 2, z: bz * ROAD_SPACING + ROAD_SPACING / 2 };
}

// ---- Key places (x, z) ----
export const GARAGE = { x: -24, z: -24 };        // Rosa's garage, mission hub
// The garage workshop itself occupies the block centre, so every mission
// interaction (start prompt, return point, car delivery) uses the forecourt
// in front of it — the apron between the workshop face (z = -35) and the
// road (z = -41). A target inside the building could never be reached.
export const GARAGE_FORECOURT = { x: -24, z: -38 };
export const HOSPITAL = { x: -72, z: -120 };     // respawn after WASTED
export const HOSPITAL_EXIT = { x: -72, z: -134 }; // outside the hospital doors
export const POLICE_STATION = { x: -120, z: 120 }; // respawn after BUSTED
export const STATION_EXIT = { x: -120, z: 134 }; // outside the station doors
export const DOCKS = { x: 184, z: 0 };           // east piers, gang territory
export const HIDEOUT = { x: 150, z: 150 };       // beach house, getaway goal
export const BEACH = { x: 0, z: 200 };           // south sand strip
export const PLAYER_START = { x: -24, z: -48 };  // on the road by the garage

// ---- Sun-soaked look ----
export const SKY_COLOR = 0x8ec7e8;
export const FOG_COLOR = 0xcfe0ea;
export const SUN_COLOR = 0xfff0c8;
export const SUN_INTENSITY = 1.25;
export const WATER_COLOR = 0x2e7f9e;
export const SAND_COLOR = 0xe8d49a;

// Stucco palettes for building facades (warm coastal city, no two streets alike).
export const FACADE_PALETTES = [
  { base: '#f2e3c6', trim: '#d9c39a', glass: '#7fa8c9' },
  { base: '#f6d9c8', trim: '#e0b49a', glass: '#6f9db8' },
  { base: '#d8e8d0', trim: '#b3cfa8', glass: '#7fa8c9' },
  { base: '#f2c9c9', trim: '#d9a3a3', glass: '#5f8aa8' },
  { base: '#cfe0ee', trim: '#a8c2d9', glass: '#4f7a9e' },
  { base: '#efe6d8', trim: '#d3c4a8', glass: '#8fb0c9' },
];

// ---- Player ----
export const PLAYER_WALK_SPEED = 5.2;
export const PLAYER_RUN_SPEED = 8.6;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_START_CASH = 250;
export const HEALTH_REGEN_DELAY = 8;   // seconds without damage before regen
export const HEALTH_REGEN_RATE = 2.5;  // health per second while regenerating

// ---- Driving ----
export const CAR_ACCEL = 14;
export const CAR_BRAKE = 26;
export const CAR_MAX_SPEED = 34;       // m/s, ~122 km/h
export const CAR_MAX_REVERSE = 10;
export const CAR_TURN_RATE = 1.9;      // radians per second at full lock
export const CAR_DRAG = 0.6;

// ---- Combat ----
export const WEAPON_MAG_SIZE = 12;
export const WEAPON_DAMAGE = 34;
export const WEAPON_RANGE = 90;
export const WEAPON_FIRE_INTERVAL = 0.16; // seconds between shots
export const WEAPON_RELOAD_TIME = 1.4;

// ---- Wanted / police ----
export const WANTED_MAX = 5;
export const WANTED_DECAY_DELAY = 18;  // seconds unseen before a star drops
export const POLICE_SPAWN_DISTANCE = 70;
export const ARREST_HOLD_TIME = 2.5;   // seconds an officer must stay close
export const BUSTED_FINE = 200;
export const WASTED_FINE = 150;

// ---- Traffic and pedestrians ----
export const TRAFFIC_COUNT = 14;
export const TRAFFIC_SPEED = 9;
export const PEDESTRIAN_COUNT = 26;
export const PED_WALK_SPEED = 1.4;
export const PED_FLEE_SPEED = 4.2;

// ---- Story ----
export const GAME_TITLE = 'SOLMAR BAY';
export const STORY_GOAL = 50000;   // the garage's protection bill: the mission
// rewards (800 + 1500 + 2500 + 3000 + 42000) plus the $250 start cash land
// Dana at $50,050 — the goal is reachable by finishing the story.
export const COLLECTIBLE_REWARD = 200; // cash per Sunset Postcard found
export const GAME_SUBTITLE = 'a sun-soaked open-world crime story';
export const PROTAGONIST = 'Dana Vega';
export const STORY_INTRO =
  'Dana Vega drives courier runs out of Rosa\u2019s garage on Marlin Street. ' +
  'The Dockside Kings want the garage — fifty thousand dollars of "protection" ' +
  'or they burn it down. Dana has one week, one rusty van, and no intention of paying.';
export const SAVE_KEY = 'solmar-bay-save-v1';
export const DEFAULT_SEED = 1;
