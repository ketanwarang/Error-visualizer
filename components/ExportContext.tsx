"use client";

import React, { createContext, useContext, useState } from "react";
import { AnnRow } from "@/lib/types";
import { exportRows } from "@/lib/export";

interface ExportState {
  rows: AnnRow[];
  datasetName: string;
}

interface ExportContextType {
  state: ExportState;
  setExportData: (rows: AnnRow[], datasetName: string) => void;
  clearExportData: () => void;
  exportAs: (format: "csv" | "xlsx") => void;
}

const ExportContext = createContext<ExportContextType | null>(null);

export function ExportProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ExportState>({ rows: [], datasetName: "" });

  const setExportData = (rows: AnnRow[], datasetName: string) => {
    setState({ rows, datasetName });
  };

  const clearExportData = () => {
    setState({ rows: [], datasetName: "" });
  };

  const exportAs = (format: "csv" | "xlsx") => {
    if (state.rows.length === 0) return;
    exportRows(state.rows, state.datasetName || "dataset", format);
  };

  return (
    <ExportContext.Provider
      value={{ state, setExportData, clearExportData, exportAs }}
    >
      {children}
    </ExportContext.Provider>
  );
}

export function useExport() {
  const ctx = useContext(ExportContext);
  if (!ctx) {
    throw new Error("useExport must be used within ExportProvider");
  }
  return ctx;
}
