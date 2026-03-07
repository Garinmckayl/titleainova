"use client";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Paperclip, Send, Mic, Image as ImageIcon } from "lucide-react";
import { useState, useRef } from "react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onFileUpload?: (file: File) => void;
  disabled?: boolean;
  placeholder?: string;
  multimodal?: boolean;
}

export function PromptInput({
  value,
  onChange,
  onSubmit,
  onFileUpload,
  disabled,
  placeholder = "Type your message...",
  multimodal = false,
}: PromptInputProps) {
  const [attachments, setAttachments] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled) {
        onSubmit();
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0 && onFileUpload) {
      files.forEach(file => onFileUpload(file));
      setAttachments(prev => [...prev, ...files]);
    }
  };

  return (
    <div className="space-y-2">
      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {attachments.map((file, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg text-sm">
              <Paperclip className="w-3 h-3" />
              <span className="text-slate-700">{file.name}</span>
              <button
                onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}
                className="text-slate-500 hover:text-slate-700"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="relative flex items-end gap-2">
        <div className="flex-1 relative">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-[60px] max-h-[200px] resize-none pr-24 border-slate-200 focus:border-slate-400 focus:ring-slate-400"
          />
          
          {/* Multimodal Actions */}
          {multimodal && (
            <div className="absolute right-2 bottom-2 flex gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileSelect}
                className="hidden"
                multiple
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
              >
                <ImageIcon className="w-4 h-4 text-slate-500" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={disabled}
              >
                <Mic className="w-4 h-4 text-slate-500" />
              </Button>
            </div>
          )}
        </div>

        {/* Send Button */}
        <Button
          onClick={onSubmit}
          disabled={disabled || !value.trim()}
          className="h-[60px] px-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>

      <p className="text-xs text-slate-500 text-center">
        Press Enter to send • Shift+Enter for new line
        {multimodal && " • Upload images or documents"}
      </p>
    </div>
  );
}
