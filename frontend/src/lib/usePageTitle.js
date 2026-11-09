/** usePageTitle: keep the browser tab title in sync with the active page. */
import { useEffect } from "react";

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · School ERP` : "School ERP";
  }, [title]);
}
