import type { Meta, StoryObj } from "@storybook/react";
import { fn } from "@storybook/test";
import { LibraryView } from "./LibraryView";
import { LibraryItem, SearchResult, MCPConnection } from "./LibraryView.types";

// Mock data for stories
const mockLibraryItems: LibraryItem[] = [
  {
    id: "1",
    name: "Project Proposal.pdf",
    type: "pdf",
    source: "local-files",
    path: "/documents/Project Proposal.pdf",
    size: 2048000,
    modifiedAt: new Date("2026-01-05T14:30:00Z"),
    createdAt: new Date("2026-01-01T09:00:00Z"),
    tags: ["work", "important", "presentation"],
    metadata: { pages: 15 },
    thumbnail: "https://via.placeholder.com/150x200/ff6b6b/ffffff?text=PDF",
  },
  {
    id: "2",
    name: "Team Photo.jpg",
    type: "image",
    source: "supabase-storage",
    path: "/images/team/Team Photo.jpg",
    size: 5242880,
    modifiedAt: new Date("2026-01-04T16:45:00Z"),
    createdAt: new Date("2026-01-04T16:45:00Z"),
    tags: ["team", "memories"],
    metadata: { width: 1920, height: 1080 },
    thumbnail: "https://via.placeholder.com/150x100/4ecdc4/ffffff?text=JPG",
  },
  {
    id: "3",
    name: "api-client.ts",
    type: "code",
    source: "mcp",
    path: "/src/lib/api-client.ts",
    size: 8192,
    modifiedAt: new Date("2026-01-08T11:20:00Z"),
    createdAt: new Date("2026-01-03T10:00:00Z"),
    tags: ["code", "api"],
    metadata: { language: "typescript", lines: 156 },
  },
  {
    id: "4",
    name: "Meeting Recording.mp4",
    type: "video",
    source: "supabase-storage",
    path: "/recordings/Meeting Recording.mp4",
    size: 104857600,
    modifiedAt: new Date("2026-01-07T15:30:00Z"),
    createdAt: new Date("2026-01-07T15:30:00Z"),
    tags: ["meetings", "important"],
    metadata: { duration: 3600, resolution: "1080p" },
    thumbnail: "https://via.placeholder.com/150x100/45b7d1/ffffff?text=MP4",
  },
  {
    id: "5",
    name: "database-schema.sql",
    type: "code",
    source: "supabase-database",
    path: "/sql/database-schema.sql",
    size: 16384,
    modifiedAt: new Date("2026-01-06T12:15:00Z"),
    createdAt: new Date("2025-12-20T14:00:00Z"),
    tags: ["database", "schema"],
    metadata: { language: "sql", tables: 8 },
  },
  {
    id: "6",
    name: "Design Assets.zip",
    type: "archive",
    source: "local-files",
    path: "/downloads/Design Assets.zip",
    size: 25165824,
    modifiedAt: new Date("2026-01-02T09:30:00Z"),
    createdAt: new Date("2026-01-02T09:30:00Z"),
    tags: ["design", "assets"],
    metadata: { files: 47, compressed: true },
  },
];

const mockSearchResults: SearchResult[] = [
  {
    item: mockLibraryItems[0],
    score: 0.95,
    matches: [
      {
        field: "name",
        text: "Project Proposal.pdf",
        highlighted: "<mark>Project</mark> Proposal.pdf",
      },
      {
        field: "tags",
        text: "work important presentation",
        highlighted: "work important <mark>presentation</mark>",
      },
    ],
  },
  {
    item: mockLibraryItems[3],
    score: 0.87,
    matches: [
      {
        field: "name",
        text: "Meeting Recording.mp4",
        highlighted: "<mark>Meeting</mark> Recording.mp4",
      },
    ],
  },
];

const mockMCPConnections: MCPConnection[] = [
  {
    id: "github-1",
    name: "GitHub - layers/tiptap-editor",
    type: "github",
    status: "connected",
    lastSync: new Date("2026-01-08T10:00:00Z"),
  },
  {
    id: "linear-1",
    name: "Linear - Product Team",
    type: "linear",
    status: "connected",
    lastSync: new Date("2026-01-08T09:45:00Z"),
  },
  {
    id: "drive-1",
    name: "Google Drive - Work",
    type: "drive",
    status: "connecting",
  },
  {
    id: "slack-1",
    name: "Slack - #general",
    type: "slack",
    status: "error",
    error: "Authentication failed. Please reconnect.",
  },
];

const meta: Meta<typeof LibraryView> = {
  title: "Components/LibraryView",
  component: LibraryView,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Comprehensive library interface with AI search, multiple data sources, and MCP integration. Supports tree, grid, and list view modes with drag-and-drop functionality.",
      },
    },
  },
  tags: ["autodocs"],
  argTypes: {
    viewMode: {
      control: "select",
      options: ["tree", "grid", "list"],
      description: "Current view mode for displaying library items",
    },
    isLoading: {
      control: "boolean",
      description: "Whether library items are currently loading",
    },
    isSearchLoading: {
      control: "boolean",
      description: "Whether search is in progress",
    },
    enableDragDrop: {
      control: "boolean",
      description: "Enable drag and drop functionality",
    },
    enableKeyboardShortcuts: {
      control: "boolean",
      description: "Enable keyboard shortcuts (Alt+V, Cmd+F)",
    },
    showConnectionStatus: {
      control: "boolean",
      description: "Show MCP connection status indicators",
    },
    compact: {
      control: "boolean",
      description: "Use compact layout for smaller spaces",
    },
    emptyStateMessage: {
      control: "text",
      description: "Custom message for empty state",
    },
  },
  args: {
    // Default actions for all stories
    fileViewer: {
      onFileOpen: fn(),
    },
    onViewModeChange: fn(),
    onSearch: fn(),
    onSelectionChange: fn(),
    onMCPManage: fn(),
    onRefresh: fn(),
    onDrag: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

// Default story with list view
export const Default: Story = {
  args: {
    viewMode: "list",
    items: mockLibraryItems,
    searchOptions: { query: "" },
    selectedItems: [],
    mcpConnections: mockMCPConnections,
    showConnectionStatus: true,
    enableKeyboardShortcuts: true,
  },
};

// Grid view mode
export const GridView: Story = {
  args: {
    ...Default.args,
    viewMode: "grid",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Grid layout displaying items as cards with thumbnails. Best for visual browsing and previews.",
      },
    },
  },
};

// Tree view mode
export const TreeView: Story = {
  args: {
    ...Default.args,
    viewMode: "tree",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Hierarchical tree structure like VS Code explorer. Best for file organization and navigation.",
      },
    },
  },
};

// Search results state
export const SearchResults: Story = {
  args: {
    ...Default.args,
    searchResults: mockSearchResults,
    searchOptions: { query: "project meeting" },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Displaying search results with similarity scores and highlighted matches. AI-powered semantic search.",
      },
    },
  },
};

// Loading state
export const Loading: Story = {
  args: {
    ...Default.args,
    isLoading: true,
    items: [],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Loading skeleton while items are being fetched from data sources.",
      },
    },
  },
};

// Search loading
export const SearchLoading: Story = {
  args: {
    ...Default.args,
    isSearchLoading: true,
    searchOptions: { query: "documents" },
  },
  parameters: {
    docs: {
      description: {
        story: "Search in progress with loading indicator and debounced input.",
      },
    },
  },
};

// Empty state
export const Empty: Story = {
  args: {
    ...Default.args,
    items: [],
    emptyStateMessage: "No files found. Connect data sources to get started.",
  },
  parameters: {
    docs: {
      description: {
        story:
          "Empty state when no items are available. Shows call-to-action to add connections.",
      },
    },
  },
};

// Empty search results
export const EmptySearch: Story = {
  args: {
    ...Default.args,
    searchResults: [],
    searchOptions: { query: "nonexistent file" },
  },
  parameters: {
    docs: {
      description: {
        story:
          "No search results found. Provides suggestions to adjust search criteria.",
      },
    },
  },
};

// Error state
export const Error: Story = {
  args: {
    ...Default.args,
    error: "Failed to load library items. Please check your connection.",
  },
  parameters: {
    docs: {
      description: {
        story: "Error state with retry options and connection troubleshooting.",
      },
    },
  },
};

// Search error
export const SearchError: Story = {
  args: {
    ...Default.args,
    searchError: "Search service unavailable. Please try again later.",
    searchOptions: { query: "test query" },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Search error with fallback to local filtering and retry options.",
      },
    },
  },
};

// Selected items
export const WithSelection: Story = {
  args: {
    ...Default.args,
    selectedItems: ["1", "3", "4"],
  },
  parameters: {
    docs: {
      description: {
        story:
          "Multiple items selected with batch operations available. Shows selection count and actions.",
      },
    },
  },
};

// Drag and drop enabled
export const WithDragDrop: Story = {
  args: {
    ...Default.args,
    enableDragDrop: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Drag and drop functionality enabled. Items can be dragged to reorder or export.",
      },
    },
  },
};

// Compact mode
export const Compact: Story = {
  args: {
    ...Default.args,
    compact: true,
    items: mockLibraryItems.slice(0, 3), // Fewer items for compact demo
  },
  parameters: {
    docs: {
      description: {
        story:
          "Compact layout for smaller spaces. Reduced spacing and simplified UI.",
      },
    },
  },
};

// Connection status variations
export const ConnectionStates: Story = {
  args: {
    ...Default.args,
    mcpConnections: mockMCPConnections,
    showConnectionStatus: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Different MCP connection states: connected, connecting, error. Shows last sync times.",
      },
    },
  },
};

// Mixed data sources
export const MixedSources: Story = {
  args: {
    ...Default.args,
    viewMode: "grid",
    items: mockLibraryItems,
    searchOptions: {
      sources: ["local-files", "supabase-storage", "mcp", "supabase-database"],
    },
  },
  parameters: {
    docs: {
      description: {
        story:
          "Items from multiple data sources: local files, Supabase storage, MCP connections, and database.",
      },
    },
  },
};

// Large dataset (for performance testing)
export const LargeDataset: Story = {
  args: {
    ...Default.args,
    items: Array.from({ length: 100 }, (_, i) => ({
      ...mockLibraryItems[i % mockLibraryItems.length],
      id: `${i + 1}`,
      name: `${mockLibraryItems[i % mockLibraryItems.length].name.replace(/\.[^.]+$/, "")} ${i + 1}${mockLibraryItems[i % mockLibraryItems.length].name.match(/\.[^.]+$/)?.[0] || ""}`,
    })),
    virtualizationThreshold: 50,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Performance testing with large dataset. Uses virtualization for smooth scrolling.",
      },
    },
  },
};

// Keyboard navigation demo
export const KeyboardNavigation: Story = {
  args: {
    ...Default.args,
    enableKeyboardShortcuts: true,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Keyboard shortcuts enabled: Alt+V (view mode), Cmd+F (search), Arrow keys (navigation).",
      },
    },
  },
  play: async ({ canvasElement }) => {
    // Demonstrate keyboard shortcuts in Storybook
    const canvas = canvasElement;

    // Focus the component
    const libraryView = canvas.querySelector('[aria-label="Library View"]');
    if (libraryView instanceof HTMLElement) {
      libraryView.focus();
    }

    // Note: Actual keyboard simulation would be added here for testing
    // This is a placeholder for the play function
  },
};

// Accessibility showcase
export const Accessibility: Story = {
  args: {
    ...Default.args,
  },
  parameters: {
    docs: {
      description: {
        story:
          "Accessibility features: ARIA labels, keyboard navigation, screen reader support, focus management.",
      },
    },
    a11y: {
      config: {
        rules: [
          {
            id: "color-contrast",
            enabled: true,
          },
          {
            id: "aria-valid-attr-value",
            enabled: true,
          },
          {
            id: "keyboard-navigation",
            enabled: true,
          },
        ],
      },
    },
  },
};
