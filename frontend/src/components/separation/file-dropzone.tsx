import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileAudio } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { cn, formatBytes } from '@/lib/utils';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/constants';

interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  selectedFile: File | null;
  onRemove: () => void;
}

export default function FileDropzone({ onFileSelect, selectedFile, onRemove }: FileDropzoneProps) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const validateAndSelect = useCallback(
    (file: File) => {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        toast.error(t('separation.unsupportedFormat'));
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(t('separation.fileTooLarge'));
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect, t],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSelect(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  if (selectedFile) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 py-12 px-8">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <FileAudio className="h-6 w-6 text-primary" />
        </div>
        <div className="text-center">
          <p className="font-semibold">{selectedFile.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatBytes(selectedFile.size)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="border border-border text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          {t('separation.browseFiles')}
        </Button>
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed py-12 px-8 text-center transition-colors',
        isDragOver
          ? 'border-primary bg-primary/5'
          : 'border-muted-foreground/25 hover:border-primary/50',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_MIME_TYPES.join(',')}
        onChange={handleInputChange}
        className="hidden"
        aria-label="Upload audio file"
      />
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Upload className="h-7 w-7 text-muted-foreground" />
      </div>
      <p className="font-semibold">{t('separation.dropzone')}</p>
      <p className="mt-1 text-[13px] text-muted-foreground">
        {t('separation.dropzoneHintClick')}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        {t('separation.dropzoneHint')}
      </p>
    </div>
  );
}
