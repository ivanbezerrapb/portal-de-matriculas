import { useEffect } from "react";

/** Browser PDF names and print-job titles follow the rendered report heading. */
export function usePrintDocumentTitle(title: string) {
  useEffect(() => {
    let previousTitle: string | undefined;
    const prepare = () => {
      if (previousTitle === undefined) previousTitle = document.title;
      document.title = title;
    };
    const restore = () => {
      if (previousTitle === undefined) return;
      document.title = previousTitle;
      previousTitle = undefined;
    };
    prepare();
    window.addEventListener("beforeprint", prepare);
    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("beforeprint", prepare);
      window.removeEventListener("afterprint", restore);
      restore();
    };
  }, [title]);
}