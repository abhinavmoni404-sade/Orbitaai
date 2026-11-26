import { useCallback, useEffect, useState } from 'react';

export function navigateTo(path: string, replace = false) {
  const [pathname, hash] = path.split('#');
  const current = window.location.pathname + window.location.search;
  if (replace) {
    window.history.replaceState({}, '', path);
  } else if (current !== path) {
    window.history.pushState({}, '', path);
  }
  window.dispatchEvent(new Event('orbita:navigate'));

  if (hash) {
    setTimeout(() => {
      const el = document.getElementById(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  } else if (pathname !== current.split('?')[0]) {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }
}

export function useLocationPath() {
  const [locationState, setLocationState] = useState(() => ({
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
  }));

  useEffect(() => {
    const sync = () => {
      setLocationState({
        pathname: window.location.pathname || '/',
        search: window.location.search || '',
      });
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('orbita:navigate', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('orbita:navigate', sync);
    };
  }, []);

  const navigate = useCallback((path: string, replace = false) => {
    navigateTo(path, replace);
  }, []);

  return {
    pathname: locationState.pathname,
    search: locationState.search,
    navigate,
  };
}
