/**
 * LibraryView Component Types
 * Comprehensive file browser with AI search, multiple data sources, and MCP integration
 */

export type ViewMode = "tree" | "grid" | "list";

export type DataSourceType =
  | "supabase-storage"
  | "supabase-database"
  | "local-files"
  | "mcp";

export type FileType =
  | "document"
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "code"
  | "archive"
  | "unknown";

export interface LibraryItem {
  id: string;
  name: string;
  type: FileType;
  source: DataSourceType;
  path: string;
  size?: number;
  modifiedAt: Date;
  createdAt: Date;
  tags?: string[];
  metadata?: Record<string, unknown>;
  thumbnail?: string;
  preview?: string;
  similarity_score?: number; // For AI search results
}

export interface SearchOptions {
  /** Search query */
  query?: string;
  /** Data sources to search in */
  sources?: DataSourceType[];
  /** File types to include */
  fileTypes?: FileType[];
  /** Tags to filter by */
  tags?: string[];
  /** Date range filter */
  dateRange?: {
    from?: Date;
    to?: Date;
  };
  /** Minimum similarity score for semantic search */
  minSimilarity?: number;
  /** Include semantic search */
  semantic?: boolean;
  /** Maximum results to return */
  limit?: number;
}

export interface SearchResult {
  item: LibraryItem;
  score: number;
  matches: {
    field: string;
    text: string;
    highlighted: string;
  }[];
}

export interface MCPConnection {
  id: string;
  name: string;
  type: "github" | "linear" | "drive" | "slack";
  status: "connected" | "connecting" | "disconnected" | "error";
  lastSync?: Date;
  error?: string;
}

export interface FileViewerConfig {
  /** Function to open file in center area */
  onFileOpen: (item: LibraryItem) => void;
  /** Function to check if file can be opened */
  canOpenFile?: (item: LibraryItem) => boolean;
  /** Function to get file preview URL */
  getPreviewUrl?: (item: LibraryItem) => string | null;
}

export interface LibraryViewProps {
  /** Current view mode */
  viewMode?: ViewMode;

  /** Callback when view mode changes */
  onViewModeChange?: (mode: ViewMode) => void;

  /** Current search options */
  searchOptions?: SearchOptions;

  /** Callback when search is performed */
  onSearch?: (options: SearchOptions) => void;

  /** Search results to display */
  searchResults?: SearchResult[];

  /** Whether search is currently loading */
  isSearchLoading?: boolean;

  /** Search error message */
  searchError?: string;

  /** All available library items for browsing */
  items?: LibraryItem[];

  /** Whether items are loading */
  isLoading?: boolean;

  /** Items loading error */
  error?: string;

  /** Currently selected item IDs */
  selectedItems?: string[];

  /** Callback when items are selected/deselected */
  onSelectionChange?: (itemIds: string[]) => void;

  /** File viewer configuration */
  fileViewer: FileViewerConfig;

  /** MCP connections status */
  mcpConnections?: MCPConnection[];

  /** Callback to manage MCP connections */
  onMCPManage?: () => void;

  /** Whether to show connection status */
  showConnectionStatus?: boolean;

  /** Callback when refresh is requested */
  onRefresh?: () => void;

  /** Whether component is in compact mode */
  compact?: boolean;

  /** Custom CSS class */
  className?: string;

  /** Custom placeholder for empty state */
  emptyStateMessage?: string;

  /** Whether drag and drop is enabled */
  enableDragDrop?: boolean;

  /** Callback for drag operations */
  onDrag?: (items: LibraryItem[]) => void;

  /** Maximum items to show before virtualization */
  virtualizationThreshold?: number;

  /** Enable keyboard shortcuts */
  enableKeyboardShortcuts?: boolean;

  /** Debug mode - shows additional info */
  debug?: boolean;
}

/**
 * Props for sub-components
 */

export interface LibraryToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  searchOptions: SearchOptions;
  onSearchOptionsChange: (options: SearchOptions) => void;
  isLoading?: boolean;
  onRefresh?: () => void;
  mcpConnections?: MCPConnection[];
  onMCPManage?: () => void;
  compact?: boolean;
}

export interface LibrarySearchBarProps {
  options: SearchOptions;
  onOptionsChange: (options: SearchOptions) => void;
  onSearch?: (options: SearchOptions) => void;
  isLoading?: boolean;
  placeholder?: string;
  enableSuggestions?: boolean;
}

export interface LibraryTreeViewProps {
  items: LibraryItem[];
  selectedItems: string[];
  onSelectionChange: (itemIds: string[]) => void;
  onFileOpen: (item: LibraryItem) => void;
  isLoading?: boolean;
  enableDragDrop?: boolean;
  onDrag?: (items: LibraryItem[]) => void;
}

export interface LibraryGridViewProps {
  items: LibraryItem[];
  selectedItems: string[];
  onSelectionChange: (itemIds: string[]) => void;
  onFileOpen: (item: LibraryItem) => void;
  isLoading?: boolean;
  enableDragDrop?: boolean;
  onDrag?: (items: LibraryItem[]) => void;
  virtualizationThreshold?: number;
}

export interface LibraryListViewProps {
  items: LibraryItem[];
  selectedItems: string[];
  onSelectionChange: (itemIds: string[]) => void;
  onFileOpen: (item: LibraryItem) => void;
  isLoading?: boolean;
  enableDragDrop?: boolean;
  onDrag?: (items: LibraryItem[]) => void;
  virtualizationThreshold?: number;
}

export interface LibraryStatusProps {
  connections: MCPConnection[];
  onManageConnections?: () => void;
  compact?: boolean;
}

export interface LibraryEmptyStateProps {
  message?: string;
  onAddConnection?: () => void;
  showActions?: boolean;
}
