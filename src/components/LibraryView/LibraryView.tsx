import * as React from "react";
import { cn } from "@/lib/utils";
import {
  LibraryViewProps,
  ViewMode,
  LibraryItem,
  SearchResult,
} from "./LibraryView.types";
import { LibraryToolbar } from "./components/LibraryToolbar";
import { LibrarySearch } from "./components/LibrarySearch";
import { LibraryTreeView } from "./components/LibraryTreeView";
import { LibraryGridView } from "./components/LibraryGridView";
import { LibraryListView } from "./components/LibraryListView";
import { LibraryStatus } from "./components/LibraryStatus";
import { LibraryEmptyState } from "./components/LibraryEmptyState";
import { LibrarySkeleton } from "./components/LibrarySkeleton";
import { SearchResults } from "../SearchResults";
import { useDebounce } from "use-debounce";

export function LibraryView({
  viewMode = "list",
  onViewModeChange,
  searchOptions = { query: "" },
  onSearch,
  searchResults,
  isSearchLoading = false,
  searchError,
  items = [],
  isLoading = false,
  error,
  selectedItems = [],
  onSelectionChange,
  fileViewer,
  mcpConnections = [],
  onMCPManage,
  showConnectionStatus = false,
  onRefresh,
  compact = false,
  className,
  emptyStateMessage,
  enableDragDrop = false,
  onDrag,
  virtualizationThreshold = 100,
  enableKeyboardShortcuts = false,
  debug = false,
}: LibraryViewProps) {
  const [query, setQuery] = React.useState(searchOptions.query || "");
  const [debouncedQuery] = useDebounce(query, 300);

  // Handle search with debouncing
  React.useEffect(() => {
    if (debouncedQuery !== searchOptions.query && onSearch) {
      onSearch({
        ...searchOptions,
        query: debouncedQuery,
      });
    }
  }, [debouncedQuery, searchOptions, onSearch]);

  // Keyboard shortcuts
  React.useEffect(() => {
    if (!enableKeyboardShortcuts) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt+V for view mode switching
      if (e.altKey && e.key === "v") {
        e.preventDefault();
        // Toggle through view modes
        const modes: ViewMode[] = ["list", "grid", "tree"];
        const currentIndex = modes.indexOf(viewMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        onViewModeChange?.(modes[nextIndex]);
      }

      // Cmd+F for search focus
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        const searchInput = document.querySelector(
          '[role="searchbox"]',
        ) as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enableKeyboardShortcuts, viewMode, onViewModeChange]);

  const handleFileOpen = (item: LibraryItem) => {
    fileViewer.onFileOpen(item);
  };

  const handleSelectionChange = (itemIds: string[]) => {
    onSelectionChange?.(itemIds);
  };

  const handleDrag = (draggedItems: LibraryItem[]) => {
    if (enableDragDrop && onDrag) {
      onDrag(draggedItems);
    }
  };

  const handleSearchChange = (newOptions: typeof searchOptions) => {
    setQuery(newOptions.query || "");
    onSearch?.(newOptions);
  };

  // Determine what to display
  const hasSearchQuery = searchOptions.query && searchOptions.query.length > 0;
  const isShowingSearchResults = hasSearchQuery && searchResults !== undefined;
  const displayItems = isShowingSearchResults
    ? searchResults.map((r) => r.item)
    : items;
  const isEmpty = displayItems.length === 0;

  return (
    <div
      className={cn(
        "flex flex-col h-full bg-background",
        compact ? "space-y-2" : "space-y-4",
        className,
      )}
      role="main"
      aria-label="Library View"
    >
      {/* Connection Status Bar */}
      {showConnectionStatus && mcpConnections.length > 0 && (
        <LibraryStatus
          connections={mcpConnections}
          onManageConnections={onMCPManage}
          compact={compact}
        />
      )}

      {/* Toolbar */}
      <LibraryToolbar
        viewMode={viewMode}
        onViewModeChange={onViewModeChange || (() => {})}
        searchOptions={searchOptions}
        onSearchOptionsChange={handleSearchChange}
        isLoading={isLoading || isSearchLoading}
        onRefresh={onRefresh}
        mcpConnections={mcpConnections}
        onMCPManage={onMCPManage}
        compact={compact}
      />

      {/* Search Interface */}
      <LibrarySearch
        options={searchOptions}
        onOptionsChange={handleSearchChange}
        onSearch={onSearch}
        isLoading={isSearchLoading}
        placeholder="Search library files..."
        enableSuggestions={true}
      />

      {/* Error States */}
      {error && (
        <div
          role="alert"
          className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg"
        >
          <p className="text-destructive">{error}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-2 px-3 py-1 bg-destructive text-destructive-foreground rounded text-sm hover:bg-destructive/90"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {searchError && (
        <div
          role="alert"
          className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg"
        >
          <p className="text-destructive">{searchError}</p>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {/* Loading State */}
        {isLoading && <LibrarySkeleton />}

        {/* Search Loading */}
        {isSearchLoading && !isLoading && (
          <div role="status" className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-muted-foreground">Searching...</span>
          </div>
        )}

        {/* Search Results */}
        {isShowingSearchResults && !isSearchLoading && searchResults && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Search Results</h2>
              <span className="text-sm text-muted-foreground">
                {searchResults.length} results
              </span>
            </div>
            <SearchResults
              results={searchResults}
              onResultClick={(result) => handleFileOpen(result.item)}
              query={searchOptions.query}
            />
          </div>
        )}

        {/* Empty Search Results */}
        {isShowingSearchResults &&
          !isSearchLoading &&
          searchResults?.length === 0 && (
            <div className="text-center p-8">
              <h3 className="text-lg font-medium mb-2">No results found</h3>
              <p className="text-muted-foreground">
                Try adjusting your search criteria or filters.
              </p>
            </div>
          )}

        {/* Regular Items Display */}
        {!isShowingSearchResults && !isLoading && !isEmpty && (
          <>
            {viewMode === "list" && (
              <LibraryListView
                items={displayItems}
                selectedItems={selectedItems}
                onSelectionChange={handleSelectionChange}
                onFileOpen={handleFileOpen}
                enableDragDrop={enableDragDrop}
                onDrag={handleDrag}
                virtualizationThreshold={virtualizationThreshold}
              />
            )}

            {viewMode === "grid" && (
              <LibraryGridView
                items={displayItems}
                selectedItems={selectedItems}
                onSelectionChange={handleSelectionChange}
                onFileOpen={handleFileOpen}
                enableDragDrop={enableDragDrop}
                onDrag={handleDrag}
                virtualizationThreshold={virtualizationThreshold}
              />
            )}

            {viewMode === "tree" && (
              <LibraryTreeView
                items={displayItems}
                selectedItems={selectedItems}
                onSelectionChange={handleSelectionChange}
                onFileOpen={handleFileOpen}
                enableDragDrop={enableDragDrop}
                onDrag={handleDrag}
              />
            )}
          </>
        )}

        {/* Empty State */}
        {!isShowingSearchResults && !isLoading && isEmpty && (
          <LibraryEmptyState
            message={
              emptyStateMessage ||
              "No files found. Connect data sources to get started."
            }
            onAddConnection={onMCPManage}
            showActions={true}
          />
        )}
      </div>

      {/* Debug Info */}
      {debug && (
        <div className="mt-4 p-2 bg-muted rounded text-xs font-mono">
          <div>View: {viewMode}</div>
          <div>Items: {displayItems.length}</div>
          <div>Selected: {selectedItems.length}</div>
          <div>Search: {searchOptions.query || "none"}</div>
          <div>Loading: {isLoading ? "yes" : "no"}</div>
        </div>
      )}
    </div>
  );
}

LibraryView.displayName = "LibraryView";
