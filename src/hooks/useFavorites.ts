import { useCallback, useEffect, useState } from "react";
import { getVisitorId } from "@/lib/analytics";

const KEY = "khmer-archive-favorites";
const EVENT = "khmer-archive-favorites-change";

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(read());
    const sync = () => setIds(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);

    // Initial background sync from server favorites
    const visitorId = getVisitorId();
    fetch(`/api/interactions/favorites?visitorId=${encodeURIComponent(visitorId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          const serverIds: string[] = [
            ...(data.data.albums || []).map((a: { id: string }) => a.id),
            ...(data.data.images || []).map((i: { id: string }) => i.id),
          ];
          if (serverIds.length > 0) {
            const merged = Array.from(new Set([...read(), ...serverIds]));
            window.localStorage.setItem(KEY, JSON.stringify(merged));
            setIds(merged);
          }
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((id: string, resourceType: "album" | "image" = "album") => {
    const current = read();
    const isCurrentlyFav = current.includes(id);
    const next = isCurrentlyFav ? current.filter((x) => x !== id) : [...current, id];
    window.localStorage.setItem(KEY, JSON.stringify(next));
    setIds(next);
    window.dispatchEvent(new Event(EVENT));

    // Sync to backend asynchronously
    const visitorId = getVisitorId();
    const endpoint = "/api/interactions/favorite";
    const method = isCurrentlyFav ? "DELETE" : "POST";
    fetch(endpoint, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        resourceType,
        resourceId: id,
        visitorId,
      }),
    }).catch(() => {});
  }, []);

  return { ids, toggle, isFavorite: (id: string) => ids.includes(id) };
}
