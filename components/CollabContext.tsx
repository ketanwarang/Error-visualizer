"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase, supabaseReady } from "@/lib/supabase";

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  imageIdx?: number;
}

interface CollabContextType {
  datasetId: string | null;
  datasetName: string | null;
  collaborators: Collaborator[];
  isLive: boolean;
  myId: string;
  myName: string;
  myColor: string;
  setCollabSession: (id: string | null, name?: string) => void;
  trackImage: (imgIdx: number) => void;
}

const COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#ec4899",
  "#f59e0b", "#06b6d4", "#f43f5e", "#6366f1"
];

const CollabContext = createContext<CollabContextType | null>(null);

export function CollabProvider({ children }: { children: React.ReactNode }) {
  const [datasetId, setDatasetIdState] = useState<string | null>(null);
  const [datasetName, setDatasetNameState] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLive, setIsLive] = useState(false);

  const [myId] = useState(() => "user_" + Math.random().toString(36).substring(2, 8));
  const [myName] = useState(() => "Inspector #" + Math.floor(100 + Math.random() * 900));
  const [myColor] = useState(() => COLORS[Math.floor(Math.random() * COLORS.length)]);

  const channelRef = useRef<any>(null);

  const setCollabSession = useCallback((id: string | null, name?: string) => {
    setDatasetIdState(id);
    setDatasetNameState(name ?? null);
  }, []);

  const trackImage = useCallback((imgIdx: number) => {
    if (channelRef.current && isLive) {
      channelRef.current.track({
        id: myId,
        name: myName,
        color: myColor,
        imageIdx: imgIdx,
      }).catch(() => {});
    }
  }, [isLive, myId, myName, myColor]);

  useEffect(() => {
    if (!supabaseReady || !datasetId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsLive(false);
      setCollaborators([]);
      return;
    }

    const ch = supabase.channel(`presence_${datasetId}`, {
      config: { presence: { key: myId } },
    });

    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const list: Collaborator[] = [];
      for (const key of Object.keys(state)) {
        const item = state[key]?.[0] as any;
        if (item) {
          list.push({
            id: item.id || key,
            name: item.name || "Anonymous",
            color: item.color || "#3b82f6",
            imageIdx: item.imageIdx,
          });
        }
      }
      setCollaborators(list);
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        setIsLive(true);
        await ch.track({
          id: myId,
          name: myName,
          color: myColor,
          imageIdx: 0,
        });
      }
    });

    channelRef.current = ch;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsLive(false);
    };
  }, [datasetId, myId, myName, myColor]);

  return (
    <CollabContext.Provider
      value={{
        datasetId,
        datasetName,
        collaborators,
        isLive,
        myId,
        myName,
        myColor,
        setCollabSession,
        trackImage,
      }}
    >
      {children}
    </CollabContext.Provider>
  );
}

export function useCollab() {
  const ctx = useContext(CollabContext);
  if (!ctx) {
    throw new Error("useCollab must be used within CollabProvider");
  }
  return ctx;
}
