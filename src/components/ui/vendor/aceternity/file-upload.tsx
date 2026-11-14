"use client";
import { cn } from "@/lib/utils";
import React, { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { IconUpload } from "@tabler/icons-react";
import { useDropzone, type Accept } from "react-dropzone";

/**
 * Drop zone for the Dhaka Chronicles media library (rewritten from Aceternity's FileUpload):
 * dark dashed card, multiple files, accept/size limits, and a status per file
 * (the parent reports progress through `statuses`).
 */
export type FileStatus = { state: "uploading" | "done" | "failed"; message?: string };

export const FileUpload = ({
  onChange,
  multiple = true,
  accept,
  maxSize,
  disabled = false,
  title = "Upload files",
  hint = "Drag and drop here, or click to choose",
  statuses = {},
}: {
  onChange?: (files: File[]) => void;
  multiple?: boolean;
  accept?: Accept;
  maxSize?: number;
  disabled?: boolean;
  title?: string;
  hint?: string;
  /** Keyed by `${name}-${lastModified}` */
  statuses?: Record<string, FileStatus>;
}) => {
  const [files, setFiles] = useState<File[]>([]);
  const [rejected, setRejected] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reduce = useReducedMotion();

  const handleFiles = (newFiles: File[]) => {
    if (!newFiles.length || disabled) return;
    setRejected(null);
    setFiles((prev) => [...newFiles, ...prev].slice(0, 20));
    onChange?.(newFiles);
  };

  const { getRootProps, isDragActive } = useDropzone({
    multiple,
    noClick: true,
    accept,
    maxSize,
    disabled,
    onDrop: handleFiles,
    onDropRejected: (r) => setRejected(`${r.length} file${r.length === 1 ? "" : "s"} skipped: ${r[0]?.errors[0]?.message ?? "not allowed"}`),
  });

  const acceptAttr = accept ? Object.entries(accept).flatMap(([mime, exts]) => [mime, ...exts]).join(",") : undefined;

  return (
    <div className="w-full" {...getRootProps()}>
      <motion.button
        type="button"
        onClick={() => !disabled && fileInputRef.current?.click()}
        whileHover={reduce || disabled ? undefined : "animate"}
        disabled={disabled}
        className={cn(
          "group/file relative block w-full overflow-hidden rounded-2xl border border-dashed p-8 text-left transition-colors",
          isDragActive ? "border-white bg-white/[0.04]" : "border-white/20 hover:border-white/40",
          disabled ? "cursor-wait opacity-70" : "cursor-pointer",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={acceptAttr}
          onChange={(e) => {
            handleFiles(Array.from(e.target.files || []));
            e.target.value = "";
          }}
          className="hidden"
        />
        <div className="pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,white,transparent)]">
          <GridPattern />
        </div>
        <div className="relative z-20 flex flex-col items-center justify-center text-center">
          <motion.span
            variants={{ initial: { y: 0 }, animate: { y: -4 } }}
            className="mb-3 grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black"
          >
            <IconUpload className="h-4 w-4 text-white" aria-hidden="true" />
          </motion.span>
          <p className="text-[15px] font-medium text-white">{isDragActive ? "Drop to upload" : title}</p>
          <p className="mt-1 text-[13px] text-muted">{hint}</p>
        </div>
      </motion.button>

      {rejected && (
        <p role="alert" className="mt-3 text-sm text-red-300">
          {rejected}
        </p>
      )}

      {files.length > 0 && (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {files.map((file) => {
            const key = `${file.name}-${file.lastModified}`;
            const st = statuses[key];
            return (
              <motion.li
                key={key}
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.08] bg-surface px-4 py-3 text-sm"
              >
                <span className="min-w-0">
                  <span className="block truncate text-white">{file.name}</span>
                  <span className="text-xs text-muted">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB · {file.type || "file"}
                  </span>
                </span>
                <span className={cn("shrink-0 text-xs", st?.state === "failed" ? "text-red-300" : st?.state === "done" ? "text-emerald-300" : "text-muted")}>
                  {st?.state === "done" ? "✓ Uploaded" : st?.state === "failed" ? `✕ ${st.message ?? "Failed"}` : st?.state === "uploading" ? "Uploading…" : "Queued"}
                </span>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export function GridPattern() {
  const columns = 41;
  const rows = 11;
  return (
    <div className="flex shrink-0 scale-105 flex-wrap items-center justify-center gap-x-px gap-y-px bg-white/[0.03]">
      {Array.from({ length: rows }).map((_, row) =>
        Array.from({ length: columns }).map((_, col) => {
          const index = row * columns + col;
          return <div key={`${col}-${row}`} className={`flex h-10 w-10 shrink-0 rounded-[2px] bg-black ${index % 2 === 0 ? "" : "shadow-[0px_0px_1px_3px_rgba(0,0,0,1)_inset]"}`} />;
        }),
      )}
    </div>
  );
}
