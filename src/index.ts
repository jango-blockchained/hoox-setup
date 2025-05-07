/**
 * Inserts embeddings and associated metadata into the Vectorize index.
 * @param vectors An array of embedding vectors (number[][]).
 * @param metadata An array of metadata objects corresponding to each vector.
 * @param env The worker environment containing the Vectorize binding.
 * @throws If the Vectorize binding is not configured or the API call fails.
 */
export async function insertEmbeddings(
  vectors: number[][],
  metadata: TelegramMessageMetadata[],
  env: Env
): Promise<void> {
  // Check for empty array first before validation
  if (vectors.length === 0 || metadata.length === 0) {
    console.log("No data to insert into Vectorize.");
    return; // Return early without throwing if either array is empty
  }

  if (vectors.length !== metadata.length) {
    throw new Error("Number of vectors must match number of metadata objects.");
  }

  if (!env.VECTORIZE_INDEX) {
    console.error(
      "VECTORIZE_INDEX binding is not configured in the environment."
    );
    throw new Error("Vectorize service not available.");
  }

  try {
    console.log(
      `Inserting ${vectors.length} vector(s) into Vectorize index...`
    );
    const response = await env.VECTORIZE_INDEX.insert(vectors, metadata);
    console.log("Vectorize insertion successful:", response);
  } catch (error: any) {
    console.error("Error inserting embeddings into Vectorize:", error);
    throw new Error(`Failed to insert embeddings: ${error.message}`);
  }
}
