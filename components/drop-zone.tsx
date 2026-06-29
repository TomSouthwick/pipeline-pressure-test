"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { HubSpotIcon, SalesforceIcon } from "@/components/crm-icons";
import { cn } from "@/lib/cn";

interface DropZoneProps {
  onFile: (file: File) => void;
  onSampleSalesforce: () => void;
  onSampleHubspot: () => void;
  error?: string | null;
}

export function DropZone({
  onFile,
  onSampleSalesforce,
  onSampleHubspot,
  error,
}: DropZoneProps) {
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a CSV file"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={cn(
          "group cursor-pointer rounded-xl border border-dashed",
          "px-6 py-10 transition-all duration-200 outline-none bg-background",
          "focus-visible:ring-2 focus-visible:ring-accent/50",
          dragging
            ? "border-accent bg-accent-dim/40"
            : "border-border-strong hover:border-accent/60 hover:bg-surface"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className="flex flex-col items-center gap-3">
          <div
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-lg border transition-colors",
              dragging
                ? "border-accent text-accent bg-background"
                : "border-border-strong text-muted group-hover:text-accent group-hover:border-accent/60 bg-surface"
            )}
          >
            <UploadIcon />
          </div>
          <div className="text-sm">
            <span className="font-medium text-foreground">
              Drop your CSV here
            </span>
            <span className="text-muted"> or click to browse</span>
          </div>
          <p className="text-xs text-muted-2">
            Parsed in your browser — nothing is uploaded.
          </p>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-bad text-center" role="alert">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center justify-center gap-3">
        <span className="h-px w-8 bg-border" />
        <span className="text-xs text-muted-2">no CSV handy?</span>
        <span className="h-px w-8 bg-border" />
      </div>

      <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2">
        <Button variant="secondary" size="md" onClick={onSampleSalesforce}>
          <SalesforceIcon />
          Try Salesforce sample
        </Button>
        <Button variant="secondary" size="md" onClick={onSampleHubspot}>
          <HubSpotIcon />
          Try HubSpot sample
        </Button>
      </div>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
