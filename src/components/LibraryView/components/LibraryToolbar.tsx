import * as React from "react";
import { Button } from "../../ui/button";
import { Tabs, TabsList, TabsTrigger } from "../../ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  List,
  Grid3x3,
  FolderTree,
  RefreshCw,
  Settings,
  MoreVertical,
} from "lucide-react";
import { LibraryToolbarProps } from "../LibraryView.types";
import { cn } from "../../../lib/utils";

export function LibraryToolbar({
  viewMode,
  onViewModeChange,
  searchOptions,
  onSearchOptionsChange,
  isLoading = false,
  onRefresh,
  mcpConnections,
  onMCPManage,
  compact = false,
}: LibraryToolbarProps) {
  const viewModeIcons = {
    list: List,
    grid: Grid3x3,
    tree: FolderTree,
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between border-b bg-background",
        compact ? "px-3 py-2" : "px-4 py-3",
      )}
    >
      {/* View Mode Switcher */}
      <div className="flex items-center space-x-2">
        <div role="group" aria-label="View mode">
          <Tabs
            value={viewMode}
            onValueChange={(value) => onViewModeChange?.(value as any)}
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="tree" className="flex items-center space-x-1">
                <FolderTree className="h-4 w-4" />
                {!compact && <span>Tree view</span>}
              </TabsTrigger>
              <TabsTrigger value="grid" className="flex items-center space-x-1">
                <Grid3x3 className="h-4 w-4" />
                {!compact && <span>Grid view</span>}
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center space-x-1">
                <List className="h-4 w-4" />
                {!compact && <span>List view</span>}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Alternative button-based view switcher for accessibility */}
        <div className="sr-only">
          <Button
            variant={viewMode === "tree" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewModeChange?.("tree")}
            aria-label="Tree view"
          >
            <FolderTree className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewModeChange?.("grid")}
            aria-label="Grid view"
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => onViewModeChange?.("list")}
            aria-label="List view"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-2">
        {/* Refresh Button */}
        {onRefresh && (
          <Button
            variant="ghost"
            size={compact ? "sm" : "default"}
            onClick={onRefresh}
            disabled={isLoading}
            aria-label="Refresh library"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            {!compact && <span className="ml-2">Refresh</span>}
          </Button>
        )}

        {/* MCP Management */}
        {onMCPManage && (
          <Button
            variant="ghost"
            size={compact ? "sm" : "default"}
            onClick={onMCPManage}
            aria-label="Manage connections"
          >
            <Settings className="h-4 w-4" />
            {!compact && <span className="ml-2">Manage connections</span>}
          </Button>
        )}

        {/* Additional Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size={compact ? "sm" : "default"}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={() =>
                onSearchOptionsChange?.({
                  ...searchOptions,
                  semantic: !searchOptions.semantic,
                })
              }
            >
              {searchOptions.semantic ? "Disable" : "Enable"} AI Search
            </DropdownMenuItem>
            <DropdownMenuItem>Export Selected</DropdownMenuItem>
            <DropdownMenuItem>View Settings</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
