// Source: workers/web3-wallet-worker/src/security.ts (lines 17-54)
// Listing id: web3-validate-transaction
// Caption: On-chain transfer guards: max USD, whitelist, enabled flag
export async function validateTransaction(
  params: ValidationParams
): Promise<ValidationResult> {
  const { config, to, valueUsd } = params;

  if (!config.enabled) {
    return { allowed: false, reason: "Wallet is disabled" };
  }

  if (valueUsd > config.security.maxTransactionValueUsd) {
    return {
      allowed: false,
      reason: `Transaction value $${valueUsd} exceeds max $${config.security.maxTransactionValueUsd}`,
    };
  }

  if (config.security.whitelistedContractsOnly) {
    const chainConfig = DEFAULT_CHAIN_CONFIGS[params.chain];
    const isDexRouter =
      chainConfig?.dexRouterAddress?.toLowerCase() === to.toLowerCase();

    if (!isDexRouter && !isContractWhitelisted(config, to)) {
      return {
        allowed: false,
        reason: "Contract not in whitelist",
      };
    }
  }

  if (config.security.requireConfirmation && valueUsd > 1000) {
    return {
      allowed: true,
      reason: "Confirmation required",
    };
  }

  return { allowed: true };
}
