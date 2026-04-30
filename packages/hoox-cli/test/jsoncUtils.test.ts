import { describe, expect, test } from "bun:test";
import { parseJsonc, stringifyJsonc, isValidJsonc } from "../src/jsoncUtils.js";

describe("JSONC Utilities", () => {
  describe("parseJsonc", () => {
    test("should parse valid JSON", () => {
      const input = '{"name": "test", "value": 123}';
      const result = parseJsonc(input);
      expect(result).toEqual({ name: "test", value: 123 });
    });

    test("should remove single-line comments", () => {
      const input = `{"name": "test"}`;
      const result = parseJsonc(input);
      expect(result).toEqual({ name: "test" });
    });

    test("should handle trailing commas", () => {
      const input = `{"name": "test", "value": 123,}`;
      const result = parseJsonc(input);
      expect(result).toEqual({ name: "test", value: 123 });
    });



    test("should preserve // and /* */ inside string values", () => {
      const input = '{"url": "https://example.com/a//b", "pattern": "/* keep me */"}';
      const result = parseJsonc(input) as { url: string; pattern: string };
      expect(result).toEqual({
        url: "https://example.com/a//b",
        pattern: "/* keep me */",
      });
    });

    test("should parse trailing commas in nested objects and arrays", () => {
      const input = `{"outer": {"inner": [1, 2,],},}`;
      const result = parseJsonc(input) as { outer: { inner: number[] } };
      expect(result).toEqual({ outer: { inner: [1, 2] } });
    });

    test("should throw on invalid JSON", () => {
      expect(() => parseJsonc('{"name":}')).toThrow();
    });
  });

  describe("isValidJsonc", () => {
    test("should return true for valid JSONC", () => {
      expect(isValidJsonc('{"name": "test"}')).toBe(true);
    });

    test("should return false for invalid JSONC", () => {
      expect(isValidJsonc('{"name": invalid}')).toBe(false);
    });
  });

  describe("stringifyJsonc", () => {
    test("should stringify object", () => {
      const result = stringifyJsonc({ name: "test", value: 123 });
      expect(result).toContain('"name": "test"');
    });
  });
});
