import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

/**
 * =========================================================================
 * 🔐 ADMIN KEYBOARD SHORTCUT CONFIGURATION & PERSISTENCE
 * =========================================================================
 *
 * Provides configurable keyboard shortcut management for Admin access.
 * Supports:
 * - Persistent storage (localStorage + Server Settings API)
 * - Dynamic runtime updates without page rebuilds
 * - Live key-recording in Admin Settings UI
 * - Modifier detection across Windows / macOS / Linux
 * - Typing safety checks (ignores typing inside inputs/textareas)
 * =========================================================================
 */

export interface AdminShortcutConfig {
  /** The key character or key name (e.g. "A", "K", "F2", "F9", "Escape", etc.) */
  key: string;
  /** Require Ctrl key (Control) */
  ctrlKey?: boolean;
  /** Require Alt / Option key */
  altKey?: boolean;
  /** Require Shift key */
  shiftKey?: boolean;
  /** Require Meta / Command / Windows key */
  metaKey?: boolean;
  /** Target route to navigate to (default: "/admin") */
  targetRoute?: string;
}

export const ADMIN_SHORTCUT_STORAGE_KEY = "watpeareang_admin_shortcut";
export const ADMIN_SHORTCUT_EVENT = "watpeareang-admin-shortcut-updated";

/**
 * Default fallback shortcut (Ctrl + Shift + A)
 */
export const DEFAULT_ADMIN_SHORTCUT: AdminShortcutConfig = {
  key: "A",
  ctrlKey: true,
  shiftKey: true,
  altKey: false,
  metaKey: false,
  targetRoute: "/admin",
};

/**
 * Active hardcoded initial fallback constant
 */
export const ADMIN_SHORTCUT: AdminShortcutConfig = { ...DEFAULT_ADMIN_SHORTCUT };

/**
 * Detects if the current client platform is macOS
 */
export function isMacOS(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return (
    /Mac|iPhone|iPad|iPod/.test(navigator.platform || "") ||
    /Macintosh|Mac OS X/.test(navigator.userAgent || "")
  );
}

/**
 * Retrieves the currently saved shortcut configuration.
 * Falls back to default if no valid custom configuration exists.
 */
export function getStoredAdminShortcut(): AdminShortcutConfig {
  if (typeof window === "undefined") return DEFAULT_ADMIN_SHORTCUT;
  try {
    const raw = localStorage.getItem(ADMIN_SHORTCUT_STORAGE_KEY);
    if (!raw) return DEFAULT_ADMIN_SHORTCUT;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.key === "string" && parsed.key.trim().length > 0) {
      return {
        key: parsed.key.trim(),
        ctrlKey: Boolean(parsed.ctrlKey),
        altKey: Boolean(parsed.altKey),
        shiftKey: Boolean(parsed.shiftKey),
        metaKey: Boolean(parsed.metaKey),
        targetRoute: parsed.targetRoute || "/admin",
      };
    }
  } catch (err) {
    console.warn("Could not read admin shortcut from storage:", err);
  }
  return DEFAULT_ADMIN_SHORTCUT;
}

/**
 * Persists the shortcut configuration to localStorage and notifies active listeners.
 */
export function saveStoredAdminShortcut(shortcut: AdminShortcutConfig): AdminShortcutConfig {
  if (typeof window === "undefined") return shortcut;
  try {
    const cleanConfig: AdminShortcutConfig = {
      key: shortcut.key.trim(),
      ctrlKey: Boolean(shortcut.ctrlKey),
      altKey: Boolean(shortcut.altKey),
      shiftKey: Boolean(shortcut.shiftKey),
      metaKey: Boolean(shortcut.metaKey),
      targetRoute: shortcut.targetRoute || "/admin",
    };
    localStorage.setItem(ADMIN_SHORTCUT_STORAGE_KEY, JSON.stringify(cleanConfig));
    window.dispatchEvent(new CustomEvent(ADMIN_SHORTCUT_EVENT, { detail: cleanConfig }));
    return cleanConfig;
  } catch (err) {
    console.error("Failed to save admin shortcut:", err);
    return shortcut;
  }
}

/**
 * Resets the shortcut configuration to the original default.
 */
export function resetStoredAdminShortcut(): AdminShortcutConfig {
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(ADMIN_SHORTCUT_STORAGE_KEY);
      window.dispatchEvent(
        new CustomEvent(ADMIN_SHORTCUT_EVENT, { detail: DEFAULT_ADMIN_SHORTCUT }),
      );
    } catch (err) {
      console.error("Failed to reset admin shortcut:", err);
    }
  }
  return DEFAULT_ADMIN_SHORTCUT;
}

/**
 * Converts a shortcut configuration into an array of readable key tokens.
 * Example: ["Ctrl", "Shift", "A"] or ["Cmd", "Option", "F9"]
 */
export function formatShortcutKeyTokens(
  config: AdminShortcutConfig,
  isMac: boolean = isMacOS(),
): string[] {
  const tokens: string[] = [];

  if (isMac) {
    if (config.ctrlKey) tokens.push("Control");
    if (config.altKey) tokens.push("Option");
    if (config.shiftKey) tokens.push("Shift");
    if (config.metaKey) tokens.push("Command");
  } else {
    if (config.ctrlKey) tokens.push("Ctrl");
    if (config.altKey) tokens.push("Alt");
    if (config.shiftKey) tokens.push("Shift");
    if (config.metaKey) tokens.push("Win");
  }

  const cleanKey = config.key ? config.key.toUpperCase() : "";
  if (cleanKey) {
    tokens.push(cleanKey);
  }

  return tokens;
}

/**
 * Formats the shortcut as a single readable string.
 * Example: "Ctrl + Shift + A"
 */
export function formatShortcutDisplay(
  config: AdminShortcutConfig,
  isMac: boolean = isMacOS(),
): string {
  const tokens = formatShortcutKeyTokens(config, isMac);
  return tokens.length > 0 ? tokens.join(" + ") : "មិនទាន់កំណត់";
}

/**
 * Safety helper: Checks whether the user is currently typing in an input,
 * textarea, select box, or contenteditable element.
 */
export function isEditableElement(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea" || tagName === "select") {
    return true;
  }
  if (target.isContentEditable) {
    return true;
  }
  return false;
}

/**
 * Matches an incoming KeyboardEvent against the given shortcut configuration.
 */
export function matchesAdminShortcut(e: KeyboardEvent, config: AdminShortcutConfig): boolean {
  if (!config.key) return false;

  const targetKey = config.key.trim().toLowerCase();
  const eventKey = e.key.trim().toLowerCase();
  const eventCode = e.code.trim().toLowerCase();

  // Match key by character or code (e.g. 'a' -> 'keya', 'f2' -> 'f2')
  const keyMatches =
    eventKey === targetKey || eventCode === `key${targetKey}` || eventCode === targetKey;

  if (!keyMatches) return false;

  // Check modifier keys strictly
  if (Boolean(config.ctrlKey) !== e.ctrlKey) return false;
  if (Boolean(config.altKey) !== e.altKey) return false;
  if (Boolean(config.shiftKey) !== e.shiftKey) return false;
  if (Boolean(config.metaKey) !== e.metaKey) return false;

  return true;
}

/**
 * Global React hook to listen for the Admin shortcut and navigate to Admin.
 * Automatically synchronizes with live shortcut updates from Settings.
 */
export function useAdminShortcut() {
  const navigate = useNavigate();
  const [activeShortcut, setActiveShortcut] = useState<AdminShortcutConfig>(getStoredAdminShortcut);

  // Sync state when shortcut is updated in Settings or another tab
  useEffect(() => {
    function handleShortcutUpdate(e: Event) {
      const customEvent = e as CustomEvent<AdminShortcutConfig>;
      if (customEvent.detail) {
        setActiveShortcut(customEvent.detail);
      } else {
        setActiveShortcut(getStoredAdminShortcut());
      }
    }

    function handleStorage(e: StorageEvent) {
      if (e.key === ADMIN_SHORTCUT_STORAGE_KEY) {
        setActiveShortcut(getStoredAdminShortcut());
      }
    }

    window.addEventListener(ADMIN_SHORTCUT_EVENT, handleShortcutUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(ADMIN_SHORTCUT_EVENT, handleShortcutUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  // Main global keydown handler
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // 1. Ignore auto-repeat when key is held down
      if (e.repeat) return;

      // 2. Never trigger while typing in an input/textarea/select/editable field
      if (isEditableElement(e.target)) return;

      // 3. Match against currently active shortcut
      if (matchesAdminShortcut(e, activeShortcut)) {
        e.preventDefault();
        navigate({ to: (activeShortcut.targetRoute || "/admin") as string });
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeShortcut, navigate]);

  return activeShortcut;
}

/**
 * Component that mounts the Admin keyboard shortcut listener globally.
 */
export function AdminShortcutListener() {
  useAdminShortcut();
  return null;
}
