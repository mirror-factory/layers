import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  CloudOff,
  Settings,
} from "lucide-react";
import { LibraryStatusProps } from "../LibraryView.types";
import { cn } from "../../../lib/utils";

export function LibraryStatus({
  connections,
  onManageConnections,
  compact = false,
}: LibraryStatusProps) {
  if (connections.length === 0) return null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case "connecting":
        return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />;
      case "error":
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      case "disconnected":
      default:
        return <CloudOff className="h-3 w-3 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting";
      case "error":
        return "Error";
      case "disconnected":
      default:
        return "Disconnected";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "bg-green-100 text-green-800 border-green-200";
      case "connecting":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "error":
        return "bg-red-100 text-red-800 border-red-200";
      case "disconnected":
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between border-b bg-muted/20",
        compact ? "px-3 py-2" : "px-4 py-3",
      )}
    >
      <div className="flex items-center space-x-3">
        <span className="text-sm font-medium text-muted-foreground">
          Data Sources:
        </span>
        <div className="flex items-center space-x-2">
          {connections.map((connection) => (
            <div key={connection.id} className="flex items-center space-x-1">
              <span className="text-sm">{connection.name}</span>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs flex items-center space-x-1",
                  getStatusColor(connection.status),
                )}
              >
                {getStatusIcon(connection.status)}
                <span>{getStatusText(connection.status)}</span>
              </Badge>
            </div>
          ))}
        </div>
      </div>

      {onManageConnections && (
        <Button
          variant="ghost"
          size={compact ? "sm" : "default"}
          onClick={onManageConnections}
          className="flex items-center space-x-1"
        >
          <Settings className="h-4 w-4" />
          <span>Manage connections</span>
        </Button>
      )}
    </div>
  );
}
