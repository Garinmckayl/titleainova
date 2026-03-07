"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export type NovaModel = "pro" | "lite" | "sonic";

interface ModelSelectorProps {
  value: NovaModel;
  onChange: (model: NovaModel) => void;
}

const models = [
  { 
    id: "pro" as NovaModel, 
    name: "Pro", 
    description: "Advanced reasoning & analysis",
    badge: "Best",
    color: "bg-purple-100 text-purple-700 border-purple-200"
  },
  { 
    id: "lite" as NovaModel, 
    name: "Lite", 
    description: "Fast & efficient",
    badge: "Fast",
    color: "bg-blue-100 text-blue-700 border-blue-200"
  },
  { 
    id: "sonic" as NovaModel, 
    name: "Sonic", 
    description: "Voice & multimodal",
    badge: "Voice",
    color: "bg-green-100 text-green-700 border-green-200"
  },
];

export function ModelSelector({ value, onChange }: ModelSelectorProps) {
  const selected = models.find(m => m.id === value);

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-slate-600">Model:</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[200px] border-slate-200">
          <SelectValue>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{selected?.name}</span>
              <Badge className={`text-xs ${selected?.color}`}>{selected?.badge}</Badge>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {models.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              <div className="flex items-center justify-between gap-3 py-1">
                <div>
                  <div className="font-semibold">{model.name}</div>
                  <div className="text-xs text-slate-500">{model.description}</div>
                </div>
                <Badge className={`text-xs ${model.color}`}>{model.badge}</Badge>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
