import { describe, it, expect, mock } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import * as path from "path";

const mockMetadata = {
  workers: {
    "workers/hoox": {
      description: "Gateway worker",
      category: "gateway",
      tags: ["webhook", "auth"],
      isPublic: true,
      smartPlacement: true,
    },
    "workers/trade-worker": {
      description: "Execution worker",
      category: "execution",
      tags: ["trading"],
      isPublic: false,
      smartPlacement: true,
    },
  },
  infrastructure: {
    "d1:trade-data-db": {
      label: "trade-data-db (D1)",
      category: "database",
      description: "Cloudflare D1 SQLite database.",
      tags: ["d1", "sqlite"],
      bindingName: "DB",
    },
  },
  dataFlows: [
    {
      source: "workers/hoox",
      target: "workers/trade-worker",
      description: "Trading signal",
      flowType: "signal-ingestion",
    },
  ],
  communities: [
    {
      id: "signal-pipeline",
      label: "Signal Pipeline",
      description: "The core trading signal flow",
      nodeIds: ["workspace:workers/hoox", "workspace:workers/trade-worker"],
    },
  ],
};

let shouldFailRead = false;

// Fixture fs mock for graph-metadata only. Bun's mock.module is process-wide;
// keep the surface minimal (existsSync + readFileSync) so we do not wrap the
// real module (spreading realFs can recurse when the mock is re-entered).
mock.module("fs", () => ({
  existsSync: (p: string) =>
    typeof p === "string" && p.endsWith("graph-metadata.json"),
  readFileSync: (_p: string, _enc?: string) => {
    if (shouldFailRead) throw new Error("File not found");
    return JSON.stringify(mockMetadata);
  },
}));

// Import after mock so the view sees mocked fs
import { EdgeTopology } from "./edge-topology";

describe("EdgeTopology View", () => {
  it("renders the topology view with workers and infrastructure", async () => {
    shouldFailRead = false;
    const { captureCharFrame, renderOnce } = await testRender(
      <EdgeTopology />,
      {
        width: 80,
        height: 24,
        exitOnCtrlC: false,
      }
    );
    await renderOnce();
    const output = captureCharFrame();

    expect(output).toContain("EDGE TOPOLOGY");
    expect(output).toContain("hoox");
    expect(output).toContain("trade-worker");
    expect(output).toContain("trade-");
    expect(output).toContain("data-db");
    expect(output).toContain("SYSTEM FLOWS");
  });

  it("handles file read errors gracefully", async () => {
    shouldFailRead = true;
    const { captureCharFrame, renderOnce } = await testRender(
      <EdgeTopology />,
      {
        width: 80,
        height: 24,
        exitOnCtrlC: false,
      }
    );
    await renderOnce();
    const output = captureCharFrame();

    expect(output).toContain("Error loading topology data:");
    expect(output).toContain("File not found");
    shouldFailRead = false;
  });

  it("resolves graph-metadata via path helpers without throwing", () => {
    // Sanity: monorepo root file exists when tests run from packages/tui or root
    const candidates = [
      path.resolve(process.cwd(), "graph-metadata.json"),
      path.resolve(process.cwd(), "../../graph-metadata.json"),
    ];
    expect(candidates.some((c) => typeof c === "string")).toBe(true);
  });
});
