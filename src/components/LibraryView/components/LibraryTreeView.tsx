import * as React from "react";
import { Checkbox } from "../../ui/checkbox";
import { ChevronRight, ChevronDown, Folder, File } from "lucide-react";
import { LibraryTreeViewProps, LibraryItem } from "../LibraryView.types";
import { cn } from "../../../lib/utils";

interface TreeNode {
  id: string;
  name: string;
  type: "folder" | "file";
  children: TreeNode[];
  item?: LibraryItem;
  path: string[];
  depth: number;
}

export function LibraryTreeView({
  items,
  selectedItems,
  onSelectionChange,
  onFileOpen,
  isLoading = false,
  enableDragDrop = false,
  onDrag,
}: LibraryTreeViewProps) {
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(
    new Set(),
  );

  // Build tree structure from flat items list
  const treeNodes = React.useMemo(() => {
    const buildTree = (items: LibraryItem[]): TreeNode[] => {
      const tree: TreeNode[] = [];
      const folderMap = new Map<string, TreeNode>();

      // First pass: create folder structure
      items.forEach((item) => {
        const pathParts = item.path.split("/").filter(Boolean);
        let currentPath: string[] = [];

        // Create folder nodes for each path segment
        pathParts.slice(0, -1).forEach((segment, index) => {
          currentPath = [...currentPath, segment];
          const folderId = currentPath.join("/");

          if (!folderMap.has(folderId)) {
            const folderNode: TreeNode = {
              id: folderId,
              name: segment,
              type: "folder",
              children: [],
              path: currentPath,
              depth: index,
            };

            folderMap.set(folderId, folderNode);

            // Add to parent or root
            if (index === 0) {
              tree.push(folderNode);
            } else {
              const parentPath = currentPath.slice(0, -1).join("/");
              const parent = folderMap.get(parentPath);
              if (parent) {
                parent.children.push(folderNode);
              }
            }
          }
        });

        // Create file node
        const fileNode: TreeNode = {
          id: item.id,
          name: item.name,
          type: "file",
          children: [],
          item,
          path: pathParts,
          depth: pathParts.length - 1,
        };

        // Add file to parent folder or root
        if (pathParts.length > 1) {
          const parentPath = pathParts.slice(0, -1).join("/");
          const parent = folderMap.get(parentPath);
          if (parent) {
            parent.children.push(fileNode);
          } else {
            tree.push(fileNode);
          }
        } else {
          tree.push(fileNode);
        }
      });

      return tree;
    };

    return buildTree(items);
  }, [items]);

  // Auto-expand folders that contain items
  React.useEffect(() => {
    const buildExpandedSet = (nodes: TreeNode[]): Set<string> => {
      const expanded = new Set<string>();

      const expandFoldersWithItems = (node: TreeNode) => {
        if (node.type === "folder" && node.children.length > 0) {
          expanded.add(node.id);
          node.children.forEach(expandFoldersWithItems);
        }
      };

      nodes.forEach(expandFoldersWithItems);
      return expanded;
    };

    if (treeNodes.length > 0) {
      setExpandedNodes(buildExpandedSet(treeNodes));
    }
  }, [treeNodes]);

  const handleItemSelect = (itemId: string, isSelected: boolean) => {
    if (isSelected) {
      onSelectionChange([...selectedItems, itemId]);
    } else {
      onSelectionChange(selectedItems.filter((id) => id !== itemId));
    }
  };

  const handleFileClick = (node: TreeNode) => {
    if (node.type === "file" && node.item) {
      onFileOpen(node.item);
    }
  };

  const handleFolderToggle = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const handleDragStart = (node: TreeNode) => {
    if (enableDragDrop && onDrag && node.item) {
      onDrag([node.item]);
    }
  };

  const renderNode = (node: TreeNode): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = node.item && selectedItems.includes(node.id);
    const hasChildren = node.children.length > 0;

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center space-x-2 px-2 py-1 rounded-md text-sm",
            "hover:bg-accent hover:text-accent-foreground cursor-pointer",
            isSelected && "bg-accent text-accent-foreground",
          )}
          style={{ paddingLeft: `${node.depth * 12 + 8}px` }}
          role="treeitem"
          aria-level={node.depth + 1}
          aria-expanded={node.type === "folder" ? isExpanded : undefined}
          aria-selected={isSelected}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (node.type === "folder") {
                handleFolderToggle(node.id);
              } else {
                handleFileClick(node);
              }
            } else if (
              e.key === "ArrowRight" &&
              node.type === "folder" &&
              !isExpanded
            ) {
              handleFolderToggle(node.id);
            } else if (
              e.key === "ArrowLeft" &&
              node.type === "folder" &&
              isExpanded
            ) {
              handleFolderToggle(node.id);
            }
          }}
        >
          {/* Expand/Collapse Icon */}
          {node.type === "folder" && (
            <button
              className="p-0 h-4 w-4 flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                handleFolderToggle(node.id);
              }}
              aria-label={isExpanded ? "Collapse folder" : "Expand folder"}
            >
              {hasChildren &&
                (isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                ))}
            </button>
          )}

          {/* Icon */}
          <div className="flex-shrink-0">
            {node.type === "folder" ? (
              <Folder className="h-4 w-4 text-blue-500" />
            ) : (
              <File className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          {/* Checkbox for files */}
          {node.type === "file" && node.item && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked: boolean) =>
                handleItemSelect(node.id, checked)
              }
              aria-label={`Select ${node.name}`}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            />
          )}

          {/* Name */}
          <span
            className="flex-1 truncate"
            onClick={() => {
              if (node.type === "folder") {
                handleFolderToggle(node.id);
              } else {
                handleFileClick(node);
              }
            }}
          >
            {node.name}
          </span>

          {/* Drag Handle */}
          {enableDragDrop && node.type === "file" && (
            <div
              className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100"
              draggable
              onDragStart={() => handleDragStart(node)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Drag ${node.name}`}
            >
              ⋮⋮
            </div>
          )}
        </div>

        {/* Children */}
        {node.type === "folder" && isExpanded && node.children.length > 0 && (
          <div>{node.children.map((child) => renderNode(child))}</div>
        )}
      </div>
    );
  };

  if (items.length === 0 && !isLoading) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No items to display
      </div>
    );
  }

  return (
    <div role="tree" aria-label="Library file tree" className="space-y-1 p-2">
      {treeNodes.map((node) => renderNode(node))}
    </div>
  );
}
