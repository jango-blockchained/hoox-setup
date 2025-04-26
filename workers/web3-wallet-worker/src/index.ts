import { ethers } from "ethers";

// Define the expected interface for a Secrets Store binding
interface SecretBinding {
  get(): Promise<string | null>;
}

export interface Env {
  // Define bindings here
  // KVNamespace: MY_KV_NAMESPACE;
  // DurableObjectNamespace: MY_DURABLE_OBJECT;
  // R2Bucket: MY_BUCKET;
  // D1Database: DB;

  // Secrets Store Bindings (names match wrangler.toml)
  WALLET_PK_SECRET?: SecretBinding;
  WALLET_MNEMONIC_SECRET?: SecretBinding;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<Response> {
    console.log(`Handling request: ${request.method} ${request.url}`);

    // Allow wallet to be either HDNodeWallet (fromPhrase) or Wallet (from private key)
    let wallet: ethers.HDNodeWallet | ethers.Wallet;

    try {
      // Attempt to get secrets from Secrets Store bindings
      const privateKey = await env.WALLET_PK_SECRET?.get();
      const mnemonic = await env.WALLET_MNEMONIC_SECRET?.get();

      if (privateKey) {
        // Prioritize Private Key if retrieved
        console.log("Using WALLET_PK_SECRET from Secrets Store.");
        // Basic validation for private key
        if (!/^0x?[0-9a-fA-F]{64}$/.test(privateKey)) {
          console.error(
            "Retrieved WALLET_PK_SECRET secret has invalid format."
          );
          return new Response("Configured private key secret is invalid.", {
            status: 500,
          });
        }
        wallet = new ethers.Wallet(
          privateKey.startsWith("0x") ? privateKey : "0x" + privateKey
        );
      } else if (mnemonic) {
        // Use Mnemonic Phrase if retrieved and no private key was found
        console.log("Using WALLET_MNEMONIC_SECRET from Secrets Store.");
        // Basic validation - check if it looks like a mnemonic
        if (mnemonic.split(" ").length < 12) {
          console.error(
            "Retrieved WALLET_MNEMONIC_SECRET secret has invalid format."
          );
          return new Response("Configured mnemonic phrase secret is invalid.", {
            status: 500,
          });
        }
        wallet = ethers.Wallet.fromPhrase(mnemonic);
      } else {
        // Neither secret could be retrieved
        console.error(
          "Could not retrieve WALLET_PK_SECRET or WALLET_MNEMONIC_SECRET from bindings."
        );
        return new Response(
          "Required wallet secret binding not configured or accessible.",
          { status: 500 }
        );
      }

      // Wallet created successfully
      console.log(`Wallet Address: ${wallet.address}`);

      // Example: Return the wallet address
      const responseBody = JSON.stringify({
        message: "Worker initialized successfully using Secrets Store.",
        walletAddress: wallet.address,
      });

      return new Response(responseBody, {
        headers: { "Content-Type": "application/json" },
        // status defaults to 200
      });
    } catch (error) {
      console.error("Error processing request:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      return new Response(`Internal Server Error: ${errorMessage}`, {
        status: 500,
      });
    }
  },
};
