import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cn, formatDate, formatRelativeTime, truncate, debounce } from "./utils";

describe("cn", () => {
  it("should merge class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("should handle conditional classes", () => {
    expect(cn("base", true && "active", false && "disabled")).toBe("base active");
  });

  it("should handle undefined and null values", () => {
    expect(cn("base", undefined, null, "end")).toBe("base end");
  });

  it("should merge conflicting Tailwind classes", () => {
    // tailwind-merge should keep the last conflicting class
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("px-4", "px-8")).toBe("px-8");
    expect(cn("mt-2", "mt-4")).toBe("mt-4");
  });

  it("should handle array inputs", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("should handle object inputs", () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe("foo baz");
  });

  it("should handle empty inputs", () => {
    expect(cn()).toBe("");
    expect(cn("")).toBe("");
  });
});

describe("formatDate", () => {
  it("should format date string with default options", () => {
    // Note: Exact output depends on locale, but should contain these parts
    const result = formatDate("2024-03-15");
    expect(result).toContain("2024");
    expect(result).toMatch(/Mar|March|3/);
    expect(result).toContain("15");
  });

  it("should format Date object", () => {
    const date = new Date("2024-06-20T12:00:00Z");
    const result = formatDate(date);
    expect(result).toContain("2024");
    expect(result).toMatch(/Jun|June|6/);
    expect(result).toContain("20");
  });

  it("should accept custom options", () => {
    const result = formatDate("2024-03-15", {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
    // Should be in a short format like "03/15/24" or similar
    expect(result).toMatch(/\d{1,2}/);
  });

  it("should handle ISO date strings", () => {
    const result = formatDate("2024-12-25T00:00:00.000Z");
    expect(result).toContain("2024");
    expect(result).toMatch(/Dec|December|12/);
  });
});

describe("formatRelativeTime", () => {
  beforeEach(() => {
    // Use Vitest's fake timers to mock Date
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-03-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should return 'Today' for same day", () => {
    expect(formatRelativeTime("2024-03-15T10:00:00Z")).toBe("Today");
  });

  it("should return 'Yesterday' for previous day", () => {
    expect(formatRelativeTime("2024-03-14T12:00:00Z")).toBe("Yesterday");
  });

  it("should return 'X days ago' for recent dates", () => {
    expect(formatRelativeTime("2024-03-12T12:00:00Z")).toBe("3 days ago");
    expect(formatRelativeTime("2024-03-10T12:00:00Z")).toBe("5 days ago");
  });

  it("should return 'X weeks ago' for older dates", () => {
    expect(formatRelativeTime("2024-03-01T12:00:00Z")).toBe("2 weeks ago");
    expect(formatRelativeTime("2024-02-22T12:00:00Z")).toBe("3 weeks ago");
  });

  it("should return formatted date for dates older than a month", () => {
    const result = formatRelativeTime("2024-01-15T12:00:00Z");
    // Should fall back to formatDate
    expect(result).toContain("2024");
    expect(result).toMatch(/Jan|January|1/);
  });
});

describe("truncate", () => {
  it("should not truncate strings shorter than maxLength", () => {
    expect(truncate("hello", 10)).toBe("hello");
    expect(truncate("test", 4)).toBe("test");
  });

  it("should truncate strings longer than maxLength", () => {
    expect(truncate("hello world", 8)).toBe("hello...");
  });

  it("should handle maxLength equal to string length", () => {
    expect(truncate("hello", 5)).toBe("hello");
  });

  it("should handle very short maxLength", () => {
    expect(truncate("hello world", 4)).toBe("h...");
    expect(truncate("test", 3)).toBe("...");
  });

  it("should handle empty strings", () => {
    expect(truncate("", 10)).toBe("");
  });

  it("should handle maxLength of 3", () => {
    // maxLength of 3 means room for exactly "..."
    expect(truncate("hello", 3)).toBe("...");
  });
});

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should delay function execution", () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should reset timer on subsequent calls", () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    vi.advanceTimersByTime(50);

    debouncedFn();
    vi.advanceTimersByTime(50);

    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should pass arguments to the debounced function", () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn("arg1", "arg2");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
  });

  it("should use the latest arguments when called multiple times", () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn("first");
    vi.advanceTimersByTime(50);

    debouncedFn("second");
    vi.advanceTimersByTime(50);

    debouncedFn("third");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("third");
  });

  it("should allow multiple independent debounced functions", () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const debouncedFn1 = debounce(fn1, 100);
    const debouncedFn2 = debounce(fn2, 50);

    debouncedFn1();
    debouncedFn2();

    vi.advanceTimersByTime(50);
    expect(fn1).not.toHaveBeenCalled();
    expect(fn2).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(50);
    expect(fn1).toHaveBeenCalledTimes(1);
  });
});
