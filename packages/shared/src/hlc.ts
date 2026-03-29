export type HlcTimestamp = {
	time: number;
	counter: number;
	node: string;
};

export class HlcDriftError extends Error {
	constructor(
		public readonly drift: number,
		public readonly maxDrift: number,
	) {
		super(`HLC drift ${drift}ms exceeds maximum allowed ${maxDrift}ms`);
		this.name = "HlcDriftError";
	}
}

export class HlcClock {
	private time = 0;
	private counter = 0;
	private readonly maxDrift: number;

	readonly node: string;

	constructor(node: string, options?: { maxDrift?: number }) {
		this.node = node;
		this.maxDrift = options?.maxDrift ?? 60_000;
	}

	/**
	 * Generate a timestamp for a local event.
	 */
	now(): HlcTimestamp {
		const physicalTime = Date.now();
		const prevTime = this.time;
		this.time = Math.max(prevTime, physicalTime);
		this.counter = this.time === prevTime ? this.counter + 1 : 0;
		return { time: this.time, counter: this.counter, node: this.node };
	}

	/**
	 * Update local clock state from a remote timestamp and return the new local timestamp.
	 */
	receive(remote: HlcTimestamp): HlcTimestamp {
		const physicalTime = Date.now();
		const drift = remote.time - physicalTime;
		if (drift > this.maxDrift) {
			throw new HlcDriftError(drift, this.maxDrift);
		}

		const prevTime = this.time;
		this.time = Math.max(prevTime, remote.time, physicalTime);

		if (this.time === prevTime && this.time === remote.time) {
			this.counter = Math.max(this.counter, remote.counter) + 1;
		} else if (this.time === prevTime) {
			this.counter = this.counter + 1;
		} else if (this.time === remote.time) {
			this.counter = remote.counter + 1;
		} else {
			this.counter = 0;
		}

		return { time: this.time, counter: this.counter, node: this.node };
	}
}

/**
 * Compare two HLC timestamps. Returns -1, 0, or 1.
 * Order: time → counter → node (lexicographic tiebreak).
 */
export function compareHlc(a: HlcTimestamp, b: HlcTimestamp): -1 | 0 | 1 {
	if (a.time !== b.time) return a.time < b.time ? -1 : 1;
	if (a.counter !== b.counter) return a.counter < b.counter ? -1 : 1;
	if (a.node !== b.node) return a.node < b.node ? -1 : 1;
	return 0;
}

/**
 * Serialize an HLC timestamp to a fixed-width sortable string.
 * Format: "000000000000000-00000-nodeId"
 *         (15-digit time)-(5-digit counter)-(node)
 *
 * String comparison on this format equals logical comparison,
 * so it can be used directly in SQLite/Postgres ORDER BY.
 */
export function serializeHlc(ts: HlcTimestamp): string {
	const t = ts.time.toString().padStart(15, "0");
	const c = ts.counter.toString().padStart(5, "0");
	return `${t}-${c}-${ts.node}`;
}

/**
 * Deserialize a string produced by serializeHlc back to an HlcTimestamp.
 * Uses position-based parsing so node IDs can contain dashes.
 */
export function deserializeHlc(s: string): HlcTimestamp {
	const time = Number.parseInt(s.slice(0, 15), 10);
	const counter = Number.parseInt(s.slice(16, 21), 10);
	const node = s.slice(22);
	return { time, counter, node };
}
