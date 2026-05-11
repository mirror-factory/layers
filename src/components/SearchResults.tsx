import * as React from "react";
import { LibraryItem } from "./LibraryView/LibraryView.types";

interface SearchResult {
  item: LibraryItem;
  score: number;
  matches: {
    field: string;
    text: string;
    highlighted: string;
  }[];
}

interface SearchResultsProps {
  results: SearchResult[];
  onResultClick: (result: SearchResult) => void;
  query?: string;
}

export function SearchResults({
  results,
  onResultClick,
  query = "",
}: SearchResultsProps) {
  if (results.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        No search results found for "{query}"
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {results.map((result) => (
        <div
          key={result.item.id}
          className="border rounded-lg p-4 hover:bg-accent cursor-pointer transition-colors"
          onClick={() => onResultClick(result)}
        >
          <div className="flex items-start space-x-3">
            {/* File type icon */}
            <div className="w-8 h-8 flex items-center justify-center rounded text-muted-foreground">
              {getFileTypeIcon(result.item.type)}
            </div>

            <div className="flex-1 min-w-0">
              {/* File name */}
              <h3 className="font-medium text-sm truncate" title={result.item.name}>
                {highlightText(result.item.name, query)}
              </h3>

              {/* File metadata */}
              <div className="text-xs text-muted-foreground mt-1">
                {result.item.size && formatFileSize(result.item.size)}
                {result.item.size && " • "}
                {formatDate(result.item.modifiedAt)}
                <span className="ml-2 capitalize">
                  {result.item.source.replace("-", " ")}
                </span>
              </div>

              {/* Matches */}
              {result.matches && result.matches.length > 0 && (
                <div className="mt-2">
                  {result.matches.slice(0, 2).map((match, index) => (
                    <div key={index} className="text-xs">
                      <span className="text-muted-foreground">{match.field}: </span>
                      <span dangerouslySetInnerHTML={{ __html: match.highlighted }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Tags */}
              {result.item.tags && result.item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {result.item.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-muted text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                  {result.item.tags.length > 3 && (
                    <span className="px-2 py-1 bg-muted text-xs rounded">
                      +{result.item.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Score */}
            <div className="text-xs text-muted-foreground">
              {Math.round(result.score * 100)}%
            </div>
          </div>
        </div>
      ))}
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

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 dark:bg-yellow-800">
        {part}
      </mark>
    ) : (
      part
    )
  );
}