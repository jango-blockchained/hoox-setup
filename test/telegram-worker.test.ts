import { describe, expect, test, jest } from "bun:test";
import { insertEmbeddings } from "../src/index";

// Mock interfaces
interface TelegramMessageMetadata {
  id: string;
  [key: string]: any;
}

interface Env {
  VECTORIZE_INDEX?: {
    insert: (vectors: number[][], metadata: any[]) => Promise<any>;
  };
}

// Setup mocks
const mockVectorizeInsert = jest.fn().mockResolvedValue({ success: true });

// Mock environment with required bindings
const mockEnv: Env = {
  VECTORIZE_INDEX: {
    insert: mockVectorizeInsert
  }
};

describe("Vector Operations", () => {
  test("should do nothing if vectors array is empty", async () => {
    // Reset the mock completely before this test
    mockVectorizeInsert.mockReset();
    await insertEmbeddings([], [], mockEnv);
    expect(mockVectorizeInsert).not.toHaveBeenCalled();
  });

  test("should insert vectors and metadata into Vectorize", async () => {
    // Reset the mock
    mockVectorizeInsert.mockReset();
    mockVectorizeInsert.mockResolvedValueOnce({ success: true });
    
    const vectors = [[0.1, 0.2, 0.3]];
    const metadata = [{ id: "1", text: "Test message" }] as TelegramMessageMetadata[];
    
    await insertEmbeddings(vectors, metadata, mockEnv);
    
    expect(mockVectorizeInsert).toHaveBeenCalledWith(vectors, metadata);
  });

  test("should throw error when Vectorize insert fails", async () => {
    // Reset the mock
    mockVectorizeInsert.mockReset();
    const error = new Error("Insert failed");
    mockVectorizeInsert.mockRejectedValueOnce(error);
    
    const vectors = [[0.1, 0.2, 0.3]];
    const metadata = [{ id: "1", text: "Test message" }] as TelegramMessageMetadata[];
    
    try {
      await insertEmbeddings(vectors, metadata, mockEnv);
      // If we get here, the test should fail because no error was thrown
      expect(true).toBe(false); // Force the test to fail
    } catch (error: any) {
      expect(error.message).toContain("Failed to insert embeddings: Insert failed");
    }
  });
}); 