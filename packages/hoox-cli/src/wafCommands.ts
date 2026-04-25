import { red, green, yellow, blue, cyan, dim, print_success, print_error, print_warning, getCloudflareToken, rl } from "./utils.js";
import type { Config } from "./types.js";

// TradingView Allowed IPs
const TRADINGVIEW_ALLOWED_IPS = [
  '52.89.214.238',
  '34.212.75.30',
  '54.218.53.128',
  '52.32.178.7',
];

export async function setupWAF(config: Config): Promise<void> {
  console.log(blue("\n--- Setting up Cloudflare WAF Rules ---"));

  const apiToken = await getCloudflareToken(config);
  if (!apiToken) {
    print_error("Cloudflare API token is missing.");
    return;
  }

  // Check if they use a custom domain (Zone ID required for WAF)
  const zoneId = await rl.question(blue("Enter your Cloudflare Zone ID (required for WAF rules, cannot use workers.dev): "));
  if (!zoneId) {
    print_error("Zone ID is required to configure WAF rules.");
    return;
  }

  console.log(dim(`Using Zone ID: ${zoneId}`));

  const WAF_RULESET_URL = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets`;

  try {
    // 1. Get existing custom ruleset (phase: http_request_firewall_custom)
    const getRulesetsResponse = await fetch(WAF_RULESET_URL, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!getRulesetsResponse.ok) {
      throw new Error(`Failed to fetch rulesets: ${await getRulesetsResponse.text()}`);
    }

    const rulesetsData = await getRulesetsResponse.json() as any;
    const customRuleset = rulesetsData.result.find((r: any) => r.phase === "http_request_firewall_custom");

    let rulesetId = customRuleset?.id;

    // The expression for the hoox worker path
    // Assuming hoox is accessible via a custom domain route, e.g., hoox.yourdomain.com
    const workerHostname = await rl.question(blue("Enter the hostname your hoox worker is routed to (e.g., hoox.example.com): "));
    
    if (!workerHostname) {
      print_error("Hostname is required.");
      return;
    }

    const ipExpression = `http.host eq "${workerHostname}" and not (ip.src in {${TRADINGVIEW_ALLOWED_IPS.join(' ')}})`;

    const ipAllowlistRule = {
      action: "block",
      expression: ipExpression,
      description: "Hoox - TradingView IP Allowlist",
      enabled: true
    };

    if (!rulesetId) {
      console.log(dim("Creating new custom ruleset..."));
      // Create new ruleset
      const createResponse = await fetch(WAF_RULESET_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: "Custom WAF Rules",
          kind: "zone",
          phase: "http_request_firewall_custom",
          rules: [ipAllowlistRule]
        })
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create ruleset: ${await createResponse.text()}`);
      }
      print_success("Created new WAF ruleset with TradingView IP Allowlist.");
    } else {
      console.log(dim(`Updating existing ruleset (${rulesetId})...`));
      
      // We need to fetch the ruleset to append to it safely
      const getRulesetResponse = await fetch(`${WAF_RULESET_URL}/${rulesetId}`, {
         headers: { "Authorization": `Bearer ${apiToken}` }
      });
      const rulesetDetails = await getRulesetResponse.json() as any;
      const existingRules = rulesetDetails.result.rules || [];

      // Check if rule already exists
      const existingRuleIndex = existingRules.findIndex((r: any) => r.description === "Hoox - TradingView IP Allowlist");
      
      if (existingRuleIndex >= 0) {
        existingRules[existingRuleIndex] = ipAllowlistRule; // Update
      } else {
        existingRules.push(ipAllowlistRule); // Append
      }

      const updateResponse = await fetch(`${WAF_RULESET_URL}/${rulesetId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rules: existingRules
        })
      });

      if (!updateResponse.ok) {
        throw new Error(`Failed to update ruleset: ${await updateResponse.text()}`);
      }
      print_success("Updated WAF ruleset with TradingView IP Allowlist.");
    }

    // 2. Setup Rate Limiting (phase: http_ratelimit)
    const rateLimitRuleset = rulesetsData.result.find((r: any) => r.phase === "http_ratelimit");
    let rlRulesetId = rateLimitRuleset?.id;

    const rateLimitRule = {
      action: "block",
      ratelimit: {
        characteristics: ["ip.src"],
        period: 60,
        requests_per_period: 10,
        mitigation_timeout: 60
      },
      expression: `http.host eq "${workerHostname}"`,
      description: "Hoox - Webhook Rate Limit (10/min)",
      enabled: true
    };

    if (!rlRulesetId) {
      console.log(dim("Creating new rate limit ruleset..."));
      const createRlResponse = await fetch(WAF_RULESET_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: "Rate Limit Rules",
          kind: "zone",
          phase: "http_ratelimit",
          rules: [rateLimitRule]
        })
      });

      if (!createRlResponse.ok) {
        throw new Error(`Failed to create rate limit ruleset: ${await createRlResponse.text()}`);
      }
      print_success("Created rate limit rule for Hoox webhooks.");
    } else {
       console.log(dim(`Updating existing rate limit ruleset (${rlRulesetId})...`));
       const getRlRulesetResponse = await fetch(`${WAF_RULESET_URL}/${rlRulesetId}`, {
         headers: { "Authorization": `Bearer ${apiToken}` }
       });
       const rlRulesetDetails = await getRlRulesetResponse.json() as any;
       const existingRlRules = rlRulesetDetails.result.rules || [];
       
       const existingRlRuleIndex = existingRlRules.findIndex((r: any) => r.description === "Hoox - Webhook Rate Limit (10/min)");
       if (existingRlRuleIndex >= 0) {
         existingRlRules[existingRlRuleIndex] = rateLimitRule;
       } else {
         existingRlRules.push(rateLimitRule);
       }

       const updateRlResponse = await fetch(`${WAF_RULESET_URL}/${rlRulesetId}`, {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          rules: existingRlRules
        })
      });

      if (!updateRlResponse.ok) {
        throw new Error(`Failed to update rate limit ruleset: ${await updateRlResponse.text()}`);
      }
      print_success("Updated rate limit rule for Hoox webhooks.");
    }

    console.log(green("\nWAF Configuration Complete."));
    console.log(yellow("Note: WAF rules are active on the specified hostname. Ensure your worker is routed via a Custom Domain."));

  } catch (error: any) {
    print_error(`Failed to configure WAF: ${error.message}`);
  }
}
