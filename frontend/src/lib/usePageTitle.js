/** usePageTitle: keep the browser tab title in sync with the active page. */
import { useEffect } from "react";
import { useSettings } from "../context/SettingsContext";

export function usePageTitle(title) {
  const { schoolName } = useSettings();
  useEffect(() => {
    document.title = title ? `${title} · ${schoolName}` : schoolName;
  }, [title, schoolName]);
}
