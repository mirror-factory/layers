import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LibraryView } from "../LibraryView";
import {
  LibraryViewProps,
  LibraryItem,
  SearchResult,
  MCPConnection,
} from "../LibraryView.types";

// Mock data
const mockLibraryItems: LibraryItem[] = [
  {
    id: "1",
    name: "Document.pdf",
    type: "pdf",
    source: "local-files",
    path: "/documents/Document.pdf",
    size: 1024000,
    modifiedAt: new Date("2026-01-01"),
    createdAt: new Date("2026-01-01"),
    tags: ["important", "work"],
  },
  {
    id: "2",
    name: "Image.jpg",
    type: "image",
    source: "supabase-storage",
    path: "/images/Image.jpg",
    size: 2048000,
    modifiedAt: new Date("2026-01-02"),
    createdAt: new Date("2026-01-02"),
    tags: ["personal"],
  },
  {
    id: "3",
    name: "Code.js",
    type: "code",
    source: "mcp",
    path: "/projects/Code.js",
    size: 512000,
    modifiedAt: new Date("2026-01-03"),
    createdAt: new Date("2026-01-03"),
  },
];

const mockSearchResults: SearchResult[] = [
  {
    item: mockLibraryItems[0],
    score: 0.95,
    matches: [
      {
        field: "name",
        text: "Document.pdf",
        highlighted: "<mark>Document</mark>.pdf",
      },
    ],
  },
  {
    item: mockLibraryItems[1],
    score: 0.87,
    matches: [
      {
        field: "tags",
        text: "personal",
        highlighted: "<mark>personal</mark>",
      },
    ],
  },
];

const mockMCPConnections: MCPConnection[] = [
  {
    id: "github-1",
    name: "GitHub - layers",
    type: "github",
    status: "connected",
    lastSync: new Date("2026-01-08T10:00:00Z"),
  },
  {
    id: "linear-1",
    name: "Linear - PROD",
    type: "linear",
    status: "connecting",
  },
];

const defaultProps: LibraryViewProps = {
  fileViewer: {
    onFileOpen: vi.fn(),
  },
  viewMode: "list",
  onViewModeChange: vi.fn(),
  searchOptions: { query: "" },
  onSearch: vi.fn(),
  items: mockLibraryItems,
  selectedItems: [],
  onSelectionChange: vi.fn(),
  mcpConnections: mockMCPConnections,
  onMCPManage: vi.fn(),
  onRefresh: vi.fn(),
};

describe("LibraryView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Rendering", () => {
    it("renders LibraryView with default props", () => {
      render(<LibraryView {...defaultProps} />);

      // Should render main container
      expect(screen.getByRole("main")).toBeInTheDocument();
      expect(screen.getByLabelText(/library view/i)).toBeInTheDocument();
    });

    it("renders search interface", () => {
      render(<LibraryView {...defaultProps} />);

      // Should render search input
      expect(screen.getByRole("searchbox")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText(/search library/i),
      ).toBeInTheDocument();
    });

    it("renders view mode switcher", () => {
      render(<LibraryView {...defaultProps} />);

      // Should render view mode buttons
      expect(screen.getByLabelText(/view mode/i)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /tree view/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /grid view/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /list view/i }),
      ).toBeInTheDocument();
    });

    it("renders library items in list mode", () => {
      render(<LibraryView {...defaultProps} viewMode="list" />);

      // Should render items list
      expect(screen.getByRole("list")).toBeInTheDocument();
      expect(screen.getByText("Document.pdf")).toBeInTheDocument();
      expect(screen.getByText("Image.jpg")).toBeInTheDocument();
      expect(screen.getByText("Code.js")).toBeInTheDocument();
    });

    it("renders library items in grid mode", () => {
      render(<LibraryView {...defaultProps} viewMode="grid" />);

      // Should render items grid
      expect(screen.getByRole("grid")).toBeInTheDocument();
      expect(screen.getByText("Document.pdf")).toBeInTheDocument();
    });

    it("renders library items in tree mode", () => {
      render(<LibraryView {...defaultProps} viewMode="tree" />);

      // Should render items tree
      expect(screen.getByRole("tree")).toBeInTheDocument();
      expect(screen.getByText("Document.pdf")).toBeInTheDocument();
    });
  });

  describe("View Mode Switching", () => {
    it("calls onViewModeChange when switching to grid view", async () => {
      const user = userEvent.setup();
      const onViewModeChange = vi.fn();

      render(
        <LibraryView {...defaultProps} onViewModeChange={onViewModeChange} />,
      );

      await user.click(screen.getByRole("button", { name: /grid view/i }));
      expect(onViewModeChange).toHaveBeenCalledWith("grid");
    });

    it("calls onViewModeChange when switching to tree view", async () => {
      const user = userEvent.setup();
      const onViewModeChange = vi.fn();

      render(
        <LibraryView {...defaultProps} onViewModeChange={onViewModeChange} />,
      );

      await user.click(screen.getByRole("button", { name: /tree view/i }));
      expect(onViewModeChange).toHaveBeenCalledWith("tree");
    });

    it("highlights active view mode", () => {
      render(<LibraryView {...defaultProps} viewMode="grid" />);

      const gridButton = screen.getByRole("button", { name: /grid view/i });
      expect(gridButton).toHaveClass("bg-primary", "text-primary-foreground");
    });
  });

  describe("Search Functionality", () => {
    it("calls onSearch when search input changes", async () => {
      const user = userEvent.setup();
      const onSearch = vi.fn();

      render(<LibraryView {...defaultProps} onSearch={onSearch} />);

      const searchInput = screen.getByRole("searchbox");
      await user.type(searchInput, "document");

      await waitFor(() => {
        expect(onSearch).toHaveBeenCalledWith(
          expect.objectContaining({
            query: "document",
          }),
        );
      });
    });

    it("shows search results when provided", () => {
      render(
        <LibraryView
          {...defaultProps}
          searchResults={mockSearchResults}
          searchOptions={{ query: "test" }}
        />,
      );

      // Should show search results instead of regular items
      expect(screen.getByText(/search results/i)).toBeInTheDocument();
      expect(screen.getByText("Document.pdf")).toBeInTheDocument();
      expect(screen.getByText("Image.jpg")).toBeInTheDocument();
    });

    it("shows search loading state", () => {
      render(<LibraryView {...defaultProps} isSearchLoading={true} />);

      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText(/searching/i)).toBeInTheDocument();
    });

    it("shows search error message", () => {
      render(<LibraryView {...defaultProps} searchError="Search failed" />);

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Search failed")).toBeInTheDocument();
    });
  });

  describe("File Operations", () => {
    it("calls fileViewer.onFileOpen when item is clicked", async () => {
      const user = userEvent.setup();
      const onFileOpen = vi.fn();

      render(<LibraryView {...defaultProps} fileViewer={{ onFileOpen }} />);

      await user.click(screen.getByText("Document.pdf"));
      expect(onFileOpen).toHaveBeenCalledWith(mockLibraryItems[0]);
    });

    it("calls onSelectionChange when items are selected", async () => {
      const user = userEvent.setup();
      const onSelectionChange = vi.fn();

      render(
        <LibraryView {...defaultProps} onSelectionChange={onSelectionChange} />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /select document.pdf/i,
      });
      await user.click(checkbox);

      expect(onSelectionChange).toHaveBeenCalledWith(["1"]);
    });

    it("shows selected items with proper styling", () => {
      render(<LibraryView {...defaultProps} selectedItems={["1"]} />);

      const selectedItem = screen
        .getByText("Document.pdf")
        .closest('[role="listitem"]');
      expect(selectedItem).toHaveClass("bg-accent");
    });
  });

  describe("MCP Connection Status", () => {
    it("shows MCP connection status", () => {
      render(<LibraryView {...defaultProps} showConnectionStatus={true} />);

      expect(screen.getByText("GitHub - layers")).toBeInTheDocument();
      expect(screen.getByText("Linear - PROD")).toBeInTheDocument();
    });

    it("shows connected status badge", () => {
      render(<LibraryView {...defaultProps} showConnectionStatus={true} />);

      expect(screen.getByText(/connected/i)).toBeInTheDocument();
      expect(screen.getByText(/connecting/i)).toBeInTheDocument();
    });

    it("calls onMCPManage when manage button is clicked", async () => {
      const user = userEvent.setup();
      const onMCPManage = vi.fn();

      render(
        <LibraryView
          {...defaultProps}
          onMCPManage={onMCPManage}
          showConnectionStatus={true}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: /manage connections/i }),
      );
      expect(onMCPManage).toHaveBeenCalled();
    });
  });

  describe("Empty States", () => {
    it("shows empty state when no items", () => {
      render(<LibraryView {...defaultProps} items={[]} />);

      expect(screen.getByText(/no files found/i)).toBeInTheDocument();
      expect(screen.getByText(/connect data sources/i)).toBeInTheDocument();
    });

    it("shows empty search results", () => {
      render(
        <LibraryView
          {...defaultProps}
          searchResults={[]}
          searchOptions={{ query: "nonexistent" }}
        />,
      );

      expect(screen.getByText(/no results found/i)).toBeInTheDocument();
      expect(
        screen.getByText(/try adjusting your search/i),
      ).toBeInTheDocument();
    });
  });

  describe("Loading States", () => {
    it("shows loading skeleton when items are loading", () => {
      render(<LibraryView {...defaultProps} isLoading={true} />);

      expect(screen.getByTestId("library-skeleton")).toBeInTheDocument();
      expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });
  });

  describe("Keyboard Shortcuts", () => {
    it("supports Alt+V for view mode switching", async () => {
      const user = userEvent.setup();
      const onViewModeChange = vi.fn();

      render(
        <LibraryView
          {...defaultProps}
          onViewModeChange={onViewModeChange}
          enableKeyboardShortcuts={true}
        />,
      );

      await user.keyboard("{Alt>}v{/Alt}");
      // Should open view mode dropdown
      expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("supports Cmd+F for search focus", async () => {
      const user = userEvent.setup();

      render(<LibraryView {...defaultProps} enableKeyboardShortcuts={true} />);

      await user.keyboard("{Meta>}f{/Meta}");

      const searchInput = screen.getByRole("searchbox");
      expect(searchInput).toHaveFocus();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels", () => {
      render(<LibraryView {...defaultProps} />);

      expect(screen.getByRole("main")).toHaveAttribute(
        "aria-label",
        "Library View",
      );
      expect(screen.getByRole("searchbox")).toHaveAttribute(
        "aria-label",
        "Search library",
      );
      expect(screen.getByRole("list")).toHaveAttribute(
        "aria-label",
        "Library items",
      );
    });

    it("supports keyboard navigation", async () => {
      const user = userEvent.setup();

      render(<LibraryView {...defaultProps} />);

      const firstItem = screen.getByText("Document.pdf");
      await user.tab();
      await user.tab(); // Navigate to first item

      expect(firstItem).toHaveFocus();
    });
  });

  describe("Drag and Drop", () => {
    it("enables drag handles when enableDragDrop is true", () => {
      render(<LibraryView {...defaultProps} enableDragDrop={true} />);

      expect(screen.getByLabelText(/drag document.pdf/i)).toBeInTheDocument();
    });

    it("calls onDrag when items are dragged", async () => {
      const onDrag = vi.fn();

      render(
        <LibraryView {...defaultProps} enableDragDrop={true} onDrag={onDrag} />,
      );

      const dragHandle = screen.getByLabelText(/drag document.pdf/i);

      fireEvent.dragStart(dragHandle);
      fireEvent.dragEnd(dragHandle);

      expect(onDrag).toHaveBeenCalledWith([mockLibraryItems[0]]);
    });
  });
});
