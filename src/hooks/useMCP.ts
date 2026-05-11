import { useState } from "react";

// Stub useMCP hook for build compatibility
export function useMCP() {
  const [isConnected, setIsConnected] = useState(false);
  const [tools, setTools] = useState<string[]>([]);

  // Mock MCP instances and statuses
  const mcps = [
    {
      config: {
        id: "github",
        name: "GitHub",
        description: "GitHub integration for code management",
        category: "Development",
        capabilities: ["list-repos", "create-issue", "search-code"]
      }
    },
    {
      config: {
        id: "linear",
        name: "Linear",
        description: "Linear integration for issue tracking",
        category: "Project Management",
        capabilities: ["list-issues", "create-issue", "update-status"]
      }
    }
  ];

  const statuses: Record<string, { status: string }> = {
    github: { status: isConnected ? "connected" : "disconnected" },
    linear: { status: isConnected ? "connected" : "disconnected" }
  };

  const connect = async () => {
    setIsConnected(true);
    setTools(["search", "summarize", "translate"]);
  };

  const disconnect = () => {
    setIsConnected(false);
    setTools([]);
  };

  const callTool = async (toolName: string, args: any) => {
    if (!isConnected) throw new Error("MCP not connected");
    // Stub implementation
    return `Tool ${toolName} called with args: ${JSON.stringify(args)}`;
  };

  return {
    isConnected,
    tools,
    mcps,
    statuses,
    connect,
    disconnect,
    callTool,
  };
}