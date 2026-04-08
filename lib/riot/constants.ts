import type { Platform, Region, PlatformInfo } from "@/types";

/** Map from platform code to regional routing host */
export const PLATFORM_TO_REGION: Record<Platform, Region> = {
  kr: "asia",
  jp1: "asia",
  na1: "americas",
  br1: "americas",
  la1: "americas",
  la2: "americas",
  euw1: "europe",
  eune1: "europe",
  tr1: "europe",
  ru: "europe",
  oc1: "sea",
  sg2: "sea",
  tw2: "sea",
  vn2: "sea",
  ph2: "sea",
};

export const PLATFORM_BASE_URL = (platform: Platform) =>
  `https://${platform}.api.riotgames.com`;

export const REGION_BASE_URL = (region: Region) =>
  `https://${region}.api.riotgames.com`;

/** All platforms with display names */
export const PLATFORMS: PlatformInfo[] = [
  { value: "kr", label: "Korea (KR)", region: "asia", flag: "🇰🇷" },
  { value: "na1", label: "North America (NA)", region: "americas", flag: "🇺🇸" },
  { value: "euw1", label: "EU West (EUW)", region: "europe", flag: "🇪🇺" },
  { value: "eune1", label: "EU Nordic & East (EUNE)", region: "europe", flag: "🇪🇺" },
  { value: "jp1", label: "Japan (JP)", region: "asia", flag: "🇯🇵" },
  { value: "br1", label: "Brazil (BR)", region: "americas", flag: "🇧🇷" },
  { value: "la1", label: "Latin America North (LAN)", region: "americas", flag: "🌎" },
  { value: "la2", label: "Latin America South (LAS)", region: "americas", flag: "🌎" },
  { value: "oc1", label: "Oceania (OCE)", region: "sea", flag: "🇦🇺" },
  { value: "tr1", label: "Turkey (TR)", region: "europe", flag: "🇹🇷" },
  { value: "ru", label: "Russia (RU)", region: "europe", flag: "🇷🇺" },
  { value: "sg2", label: "Singapore (SG)", region: "sea", flag: "🇸🇬" },
  { value: "tw2", label: "Taiwan (TW)", region: "sea", flag: "🇹🇼" },
  { value: "vn2", label: "Vietnam (VN)", region: "sea", flag: "🇻🇳" },
  { value: "ph2", label: "Philippines (PH)", region: "sea", flag: "🇵🇭" },
];

/** Queue IDs we care about for role inference */
export const RANKED_SOLO_QUEUE_ID = 420;
export const RANKED_FLEX_QUEUE_ID = 440;
export const NORMAL_DRAFT_QUEUE_ID = 400;
export const NORMAL_BLIND_QUEUE_ID = 430;
export const ARAM_QUEUE_ID = 450;

/** Queue IDs to include in role inference */
export const ROLE_INFERENCE_QUEUE_IDS = new Set([
  RANKED_SOLO_QUEUE_ID,
  RANKED_FLEX_QUEUE_ID,
  NORMAL_DRAFT_QUEUE_ID,
  NORMAL_BLIND_QUEUE_ID,
]);

/** How many recent matches to fetch for role inference */
export const RECENT_MATCH_COUNT = 20;

/** Minimum matches to make a reliable role inference */
export const MIN_MATCHES_FOR_INFERENCE = 3;

/** Cache TTL in milliseconds */
export const PLAYER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const MATCH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
