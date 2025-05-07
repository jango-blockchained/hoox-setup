import { describe, expect, test } from "bun:test";
import { insertEmbeddings } from "../src/index";

describe("Basic Functionality", () => {
  // Test that empty vectors and metadata don't throw
  test("insertEmbeddings should handle empty arrays gracefully", async () => {
    const mockEnv = { VECTORIZE_INDEX: {} } as any;

    // Should not throw for empty arrays
    await insertEmbeddings([], [], mockEnv);
    // This test passes if the function doesn't throw
  });

  // Test error handling when Vectorize is not available
  test("insertEmbeddings should throw when Vectorize is not available", async () => {
    const mockEnv = { VECTORIZE_INDEX: undefined } as any;
    const vectors = [[0.1, 0.2]];
    const metadata = [{ id: "1" }] as any;

    try {
      await insertEmbeddings(vectors, metadata, mockEnv);
      // If we get here, the test should fail because no error was thrown
      expect(true).toBe(false); // Force the test to fail
    } catch (error: any) {
      expect(error.message).toContain("Vectorize service not available");
    }
  });

  // Test that non-matching array lengths throw an error
  test("insertEmbeddings should throw when lengths don't match", async () => {
    const mockEnv = { VECTORIZE_INDEX: {} } as any;
    const vectors = [
      [0.1, 0.2],
      [0.3, 0.4],
    ]; // Two vectors
    const metadata = [{ id: "1" }]; // But only one metadata

    try {
      await insertEmbeddings(vectors, metadata, mockEnv);
      // If we get here, the test should fail because no error was thrown
      expect(true).toBe(false); // Force the test to fail
    } catch (error: any) {
      expect(error.message).toContain(
        "Number of vectors must match number of metadata objects"
      );
    }
  });
});
