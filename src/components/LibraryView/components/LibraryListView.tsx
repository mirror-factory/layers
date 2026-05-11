import * as React from "react";
import { Checkbox } from "../../ui/checkbox";
import { LibraryListViewProps } from "../LibraryView.types";
import { cn } from "../../../lib/utils";

export function LibraryListView({
  items,
  selectedItems,
  onSelectionChange,
  onFileOpen,
  isLoading = false,
  enableDragDrop = false,
  onDrag,
  virtualizationThreshold = 100,
}: LibraryListViewProps) {
  const handleItemSelect = (itemId: string, isSelected: boolean) => {
    if (isSelected) {
      onSelectionChange([...selectedItems, itemId]);
    } else {
      onSelectionChange(selectedItems.filter((id) => id !== itemId));
    }
  };

  const handleItemClick = (item: any) => {
    onFileOpen(item);
  };

  const handleDragStart = (item: any) => {
    if (enableDragDrop && onDrag) {
      onDrag([item]);
    }
  };

  if (items.length === 0 && !isLoading) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No items to display
      </div>
    );
  }

  return (
    <div role="list" aria-label="Library items" className="space-y-1">
      {items.map((item, index) => {
        const isSelected = selectedItems.includes(item.id);

        return (
          <div
            key={item.id}
            role="listitem"
            className={cn(
              "flex items-center space-x-3 p-3 rounded-lg border transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              isSelected && "bg-accent border-primary",
            )}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleItemClick(item);
              }
            }}
          >
            {/* Selection Checkbox */}
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked: boolean) =>
                handleItemSelect(item.id, checked)
              }
              aria-label={`Select ${item.name}`}
            />

            {/* Drag Handle */}
            {enableDragDrop && (
              <div
                className="cursor-grab active:cursor-grabbing"
                draggable
                onDragStart={() => handleDragStart(item)}
                aria-label={`Drag ${item.name}`}
              >
                ⋮⋮
              </div>
            )}

            {/* Item Content */}
            <div
              className="flex-1 flex items-center space-x-3 cursor-pointer"
              onClick={() => handleItemClick(item)}
            >
              {/* File Type Icon */}
              <div className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground">
                {getFileTypeIcon(item.type)}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate" title={item.name}>
                  {item.name}
                </h3>
                <div className="text-xs text-muted-foreground">
                  {item.size && formatFileSize(item.size)}
                  {item.size && " • "}
                  {formatDate(item.modifiedAt)}
                </div>
              </div>

              {/* Source */}
              <div className="text-xs text-muted-foreground capitalize">
                {item.source.replace("-", " ")}
              </div>

              {/* Tags */}
              {item.tags && item.tags.length > 0 && (
                <div className="flex space-x-1">
                  {item.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-muted text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  {item.tags.length > 2 && (
                    <span className="px-2 py-1 bg-muted text-xs rounded">
                      +{item.tags.length - 2}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Helper functions
function getFileTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    pdf: "📄",
    image: "🖼️",
    video: "🎥",
    audio: "🎵",
    code: "💻",
    document: "📝",
    archive: "📦",
    unknown: "📄",
  };
  return icons[type] || icons.unknown;
}

function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${Math.round(size * 10) / 10} ${units[unitIndex]}`;
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString();
}
