import { describe, it, expect, beforeEach, mock } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { EdgeTopology } from "./edge-topology";
import * as fs from "fs";

// Mock fs to return a dummy graph-metadata.json
mock.module("fs", () => ({
  readFileSync: () => JSON.stringify(mockMetadata),
}));

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

describe("EdgeTopology View", () => {
  it("renders the topology view with workers and infrastructure", async () => {
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
    mock.module("fs", () => ({
      readFileSync: () => {
        throw new Error("File not found");
      },
    }));

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
  });
});
