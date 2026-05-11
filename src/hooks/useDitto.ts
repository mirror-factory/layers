import { useState } from "react";

// Inline type for build compatibility
type DittoModelId = "gpt-4" | "gpt-3.5" | "claude";

// Stub useDitto hook for build compatibility
export function useDitto() {
  const [model, setModel] = useState<DittoModelId>("gpt-4");
  const [isLoading, setIsLoading] = useState(false);

  const generateText = async (prompt: string) => {
    setIsLoading(true);
    // Stub implementation
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsLoading(false);
    return `Generated response for: ${prompt}`;
  };

  return {
    model,
    setModel,
    isLoading,
    generateText,
  };
}