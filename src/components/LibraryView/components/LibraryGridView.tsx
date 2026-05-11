import * as React from "react";
import { Checkbox } from "../../ui/checkbox";
import { LibraryGridViewProps } from "../LibraryView.types";
import { cn } from "../../../lib/utils";

export function LibraryGridView({
  items,
  selectedItems,
  onSelectionChange,
  onFileOpen,
  isLoading = false,
  enableDragDrop = false,
  onDrag,
  virtualizationThreshold = 100,
}: LibraryGridViewProps) {
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
    <div
      role="grid"
      aria-label="Library items grid"
      className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 p-4"
    >
      {items.map((item, index) => {
        const isSelected = selectedItems.includes(item.id);

        return (
          <div
            key={item.id}
            role="gridcell"
            className={cn(
              "relative group rounded-lg border transition-all duration-200",
              "hover:shadow-md hover:border-primary/50",
              isSelected && "ring-2 ring-primary border-primary bg-accent/30",
            )}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleItemClick(item);
              }
            }}
          >
            {/* Selection Checkbox - Top Left */}
            <div className="absolute top-2 left-2 z-10">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked: boolean) =>
                  handleItemSelect(item.id, checked)
                }
                aria-label={`Select ${item.name}`}
                className="bg-background/80 backdrop-blur-sm"
              />
            </div>

            {/* Drag Handle - Top Right */}
            {enableDragDrop && (
              <div
                className="absolute top-2 right-2 z-10 p-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm rounded"
                draggable
                onDragStart={() => handleDragStart(item)}
                aria-label={`Drag ${item.name}`}
              >
                ⋮⋮
              </div>
            )}

            {/* Main Content */}
            <div
              className="p-4 cursor-pointer h-full"
              onClick={() => handleItemClick(item)}
            >
              {/* Thumbnail/Icon */}
              <div className="aspect-video bg-muted rounded-md mb-3 flex items-center justify-center overflow-hidden">
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="text-4xl text-muted-foreground">
                    {getFileTypeIcon(item.type)}
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="space-y-1">
                <h3 className="font-medium text-sm truncate" title={item.name}>
                  {item.name}
                </h3>
                <div className="text-xs text-muted-foreground">
                  {item.size && formatFileSize(item.size)}
                  {item.size && " • "}
                  {formatDate(item.modifiedAt)}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {item.source.replace("-", " ")}
                </div>
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {item.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-muted text-xs rounded"
                      >
                        {tag}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="px-2 py-1 bg-muted text-xs rounded">
                        +{item.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
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
