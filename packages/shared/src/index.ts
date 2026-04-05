export const APP_NAME = "Symlink";

export type { HlcTimestamp } from "./hlc.js";
export {
	compareHlc,
	deserializeHlc,
	HlcClock,
	HlcDriftError,
	serializeHlc,
} from "./hlc.js";
