import * as React from "react";
import { Input } from "../../ui/input";
import { Button } from "../../ui/button";
import { Search, Loader2 } from "lucide-react";
import { LibrarySearchBarProps } from "../LibraryView.types";

export function LibrarySearch({
  options,
  onOptionsChange,
  onSearch,
  isLoading = false,
  placeholder = "Search library files...",
  enableSuggestions = false,
}: LibrarySearchBarProps) {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    onOptionsChange({ ...options, query });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && options.query?.trim()) {
      onSearch(options);
    }
  };

  return (
    <div role="search" aria-label="Search library" className="flex-1">
      <form onSubmit={handleSubmit} className="relative flex gap-2">
        <div className="relative flex-1">
          <Input
            role="searchbox"
            type="search"
            value={options.query || ""}
            onChange={handleInputChange}
            placeholder={placeholder}
            aria-label="Search library"
            className="pr-10"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={isLoading || !options.query?.trim()}
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </Button>
      </form>
    </div>
  );
}
