import { useEffect } from 'react';

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} — Al Seef Resort` : 'Al Seef Resort';
    return () => { document.title = 'Al Seef Resort'; };
  }, [title]);
}
