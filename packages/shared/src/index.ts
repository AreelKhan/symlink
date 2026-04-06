export const APP_NAME = "Symlink";

export { appendEvent } from "./event-store.js";
export type { HlcTimestamp } from "./hlc.js";
export {
	compareHlc,
	deserializeHlc,
	HlcClock,
	HlcDriftError,
	serializeHlc,
} from "./hlc.js";
export { type Event, events, type NewEvent } from "./schema/events.js";
export { uuidv7 } from "./uuidv7.js";
