import { useCallback, useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function UploadDropzone({
  onFiles,
  busy,
  compact,
}: {
  onFiles: (files: File[]) => void;
  busy?: boolean;
  compact?: boolean;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const arr = Array.from(files).filter((f) =>
        /\.(xlsx?|csv)$/i.test(f.name),
      );
      if (arr.length === 0) return;
      onFiles(arr);
    },
    [onFiles],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "group cursor-pointer rounded-2xl border-2 border-dashed transition-all",
        "border-border bg-card hover:border-primary hover:bg-accent/40",
        drag && "border-primary bg-accent scale-[1.01]",
        compact ? "p-6" : "p-12",
      )}
      role="button"
      tabIndex={0}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
      />
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-110",
            "bg-[image:var(--gradient-brand)] text-white shadow-[var(--shadow-card)]",
          )}
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <Upload className="h-6 w-6" />
          )}
        </div>
        <div>
          <p className="font-semibold text-foreground">
            {busy ? "Processing…" : "Drop attendance files here"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            One Zoom export per session — .xlsx, .xls, or .csv. You can upload multiple.
          </p>
        </div>
      </div>
    </div>
  );
}
