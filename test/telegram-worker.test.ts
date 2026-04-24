import { describe, expect, test, jest } from "bun:test";
import { insertEmbeddings, type TelegramMessageMetadata, type Env } from "../src/index";

// Setup mocks
const mockVectorizeInsert = jest.fn().mockResolvedValue({ success: true });

// Mock environment with required bindings
const mockEnv = {
  VECTORIZE_INDEX: {
    insert: mockVectorizeInsert,
  },
} as unknown as Env;

describe("Vector Operations", () => {
  test("should do nothing if vectors array is empty", async () => {
    mockVectorizeInsert.mockReset();
    await insertEmbeddings([], [], mockEnv);
    expect(mockVectorizeInsert).not.toHaveBeenCalled();
  });

  test("should insert vectors and metadata into Vectorize", async () => {
    mockVectorizeInsert.mockReset();
    mockVectorizeInsert.mockResolvedValueOnce({ success: true });

    const vectors = [[0.1, 0.2, 0.3]];
    const metadata = [
      { messageId: "1", chatId: "1", text: "Test message", timestamp: "123" },
    ];

    await insertEmbeddings(vectors, metadata, mockEnv);

    expect(mockVectorizeInsert).toHaveBeenCalledWith(vectors, metadata);
  });

  test("should throw error when Vectorize insert fails", async () => {
    // Reset the mock
    mockVectorizeInsert.mockReset();
    const error = new Error("Insert failed");
    mockVectorizeInsert.mockRejectedValueOnce(error);

    const vectors = [[0.1, 0.2, 0.3]];
    const metadata = [
      { messageId: "1", chatId: "1", text: "Test message", timestamp: "123" },
    ];

    try {
      await insertEmbeddings(vectors, metadata, mockEnv);
      expect(true).toBe(false);
    } catch (error: unknown) {
      expect(error instanceof Error && error.message).toContain(
        "Failed to insert embeddings: Insert failed"
      );
    }
  });
});
