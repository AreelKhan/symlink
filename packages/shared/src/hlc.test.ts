import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
	compareHlc,
	deserializeHlc,
	HlcClock,
	HlcDriftError,
	serializeHlc,
} from "./hlc.js";

let now: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
	now = vi.spyOn(Date, "now").mockReturnValue(1000);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("HlcClock.now()", () => {
	test("first call returns physical time with counter 0", () => {
		now.mockReturnValue(5000);
		const clock = new HlcClock("A");
		const ts = clock.now();
		expect(ts).toEqual({ time: 5000, counter: 0, node: "A" });
	});

	test("consecutive calls in same millisecond increment counter", () => {
		const clock = new HlcClock("A");
		const ts1 = clock.now();
		const ts2 = clock.now();
		const ts3 = clock.now();
		expect(ts1.counter).toBe(0);
		expect(ts2.counter).toBe(1);
		expect(ts3.counter).toBe(2);
		expect(ts1.time).toBe(ts2.time);
	});

	test("counter resets when physical time advances", () => {
		const clock = new HlcClock("A");
		clock.now();
		clock.now();
		now.mockReturnValue(1001);
		const ts = clock.now();
		expect(ts.counter).toBe(0);
	});

	test("time never goes backwards", () => {
		now.mockReturnValue(5000);
		const clock = new HlcClock("A");
		const ts1 = clock.now();
		now.mockReturnValue(3000);
		const ts2 = clock.now();
		expect(ts2.time).toBe(ts1.time);
		expect(ts2.counter).toBe(ts1.counter + 1);
	});
});

describe("HlcClock.receive()", () => {
	test("advances local time to remote when remote is ahead", () => {
		const clock = new HlcClock("A");
		clock.now();
		now.mockReturnValue(1000);
		const ts = clock.receive({ time: 2000, counter: 5, node: "B" });
		expect(ts.time).toBe(2000);
		expect(ts.counter).toBe(6);
		expect(ts.node).toBe("A");
	});

	test("keeps local time when local is ahead", () => {
		now.mockReturnValue(5000);
		const clock = new HlcClock("A");
		clock.now();
		const ts = clock.receive({ time: 3000, counter: 10, node: "B" });
		expect(ts.time).toBe(5000);
		expect(ts.counter).toBe(1);
	});

	test("takes max counter + 1 when times are equal", () => {
		const clock = new HlcClock("A");
		clock.now(); // time=1000, counter=0
		const ts = clock.receive({ time: 1000, counter: 7, node: "B" });
		expect(ts.time).toBe(1000);
		expect(ts.counter).toBe(8); // max(0, 7) + 1
	});

	test("keeps previous time when both remote and physical are behind", () => {
		now.mockReturnValue(5000);
		const clock = new HlcClock("A");
		clock.now(); // time=5000, counter=0
		clock.now(); // time=5000, counter=1
		now.mockReturnValue(3000);
		const ts = clock.receive({ time: 4000, counter: 10, node: "B" });
		expect(ts.time).toBe(5000);
		expect(ts.counter).toBe(2);
	});

	test("uses greater counter when local counter exceeds remote", () => {
		const clock = new HlcClock("A");
		clock.now(); // time=1000, counter=0
		clock.now(); // time=1000, counter=1
		clock.now(); // time=1000, counter=2
		const ts = clock.receive({ time: 1000, counter: 1, node: "B" });
		expect(ts.time).toBe(1000);
		expect(ts.counter).toBe(3); // max(2, 1) + 1
	});

	test("resets counter when physical time wins", () => {
		const clock = new HlcClock("A");
		clock.now(); // time=1000, counter=0
		now.mockReturnValue(9000);
		const ts = clock.receive({ time: 2000, counter: 5, node: "B" });
		expect(ts.time).toBe(9000);
		expect(ts.counter).toBe(0);
	});

	test("now after receive with stale physical clock increments from receive state", () => {
		const clock = new HlcClock("A");
		clock.now(); // physical=1000 → time=1000, counter=0
		const recv = clock.receive({ time: 2000, counter: 0, node: "B" });
		expect(recv).toEqual({ time: 2000, counter: 1, node: "A" });
		now.mockReturnValue(1500); // physical clock still behind
		const ts = clock.now();
		expect(ts).toEqual({ time: 2000, counter: 2, node: "A" });
	});

	test("throws HlcDriftError when remote is too far ahead", () => {
		const clock = new HlcClock("A");
		expect(() =>
			clock.receive({ time: 200_000, counter: 0, node: "B" }),
		).toThrow(HlcDriftError);
	});

	test("allows drift within maxDrift", () => {
		const clock = new HlcClock("A");
		// default maxDrift is 60_000, so 50s ahead is fine
		const ts = clock.receive({ time: 51_000, counter: 0, node: "B" });
		expect(ts.time).toBe(51_000);
	});
});

describe("compareHlc()", () => {
	test("orders by time first", () => {
		const a = { time: 1000, counter: 5, node: "Z" };
		const b = { time: 2000, counter: 0, node: "A" };
		expect(compareHlc(a, b)).toBe(-1);
		expect(compareHlc(b, a)).toBe(1);
	});

	test("orders by counter when times are equal", () => {
		const a = { time: 1000, counter: 3, node: "Z" };
		const b = { time: 1000, counter: 7, node: "A" };
		expect(compareHlc(a, b)).toBe(-1);
		expect(compareHlc(b, a)).toBe(1);
	});

	test("orders by node when time and counter are equal", () => {
		const a = { time: 1000, counter: 0, node: "A" };
		const b = { time: 1000, counter: 0, node: "B" };
		expect(compareHlc(a, b)).toBe(-1);
		expect(compareHlc(b, a)).toBe(1);
	});

	test("returns 0 for identical timestamps", () => {
		const a = { time: 1000, counter: 0, node: "A" };
		expect(compareHlc(a, { ...a })).toBe(0);
	});
});

describe("serialization", () => {
	test("round-trips correctly", () => {
		const ts = { time: 1719000000000, counter: 42, node: "device-abc-123" };
		const serialized = serializeHlc(ts);
		const deserialized = deserializeHlc(serialized);
		expect(deserialized).toEqual(ts);
	});

	test("produces fixed-width sortable strings", () => {
		const a = serializeHlc({ time: 1000, counter: 0, node: "A" });
		const b = serializeHlc({ time: 2000, counter: 0, node: "A" });
		const c = serializeHlc({ time: 1000, counter: 1, node: "A" });
		// string sort should match logical sort
		const sorted = [b, c, a].sort();
		expect(sorted).toEqual([a, c, b]);
	});

	test("handles node IDs with dashes (UUIDs)", () => {
		const ts = {
			time: 1719000000000,
			counter: 0,
			node: "550e8400-e29b-41d4-a716-446655440000",
		};
		const deserialized = deserializeHlc(serializeHlc(ts));
		expect(deserialized).toEqual(ts);
	});
});
