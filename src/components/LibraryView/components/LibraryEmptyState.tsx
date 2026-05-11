import { Button } from "@/components/ui/button";
import { FolderOpen, Plus } from "lucide-react";
import { LibraryEmptyStateProps } from "../LibraryView.types";

export function LibraryEmptyState({
  message = "No files found",
  onAddConnection,
  showActions = true,
}: LibraryEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <FolderOpen className="h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">No files found</h3>
      <p className="text-muted-foreground mb-6 max-w-sm">{message}</p>

      {showActions && (
        <div className="flex flex-col sm:flex-row gap-3">
          {onAddConnection && (
            <Button
              onClick={onAddConnection}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Connect data sources
            </Button>
          )}
          <Button variant="outline">Upload files</Button>
        </div>
      )}
    </div>
  );
}
