import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";
import { PAGE_SIZE } from "../lib/constants";

/** Fetch every page of a paginated endpoint (bounded for safety). */
export async function fetchAll(path, params = {}) {
  let page = 1;
  let results = [];
  let guard = 0;
  while (guard < 25) {
    const data = await api.get(path, { ...params, page, page_size: 100 });
    if (Array.isArray(data)) return data;
    results = results.concat(data.results || []);
    if (!data.next) break;
    page += 1;
    guard += 1;
  }
  return results;
}

export function useAll(path, params = {}, { enabled = true } = {}) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const key = JSON.stringify(params || {});

  const reload = useCallback(async () => {
    if (!enabled || !path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchAll(path, JSON.parse(key)));
    } catch (err) {
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [path, key, enabled]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

/** Paginated + filtered list state for a DRF endpoint. */
export function useList(path, initialParams = {}, { pageSize = PAGE_SIZE, enabled = true } = {}) {
  const [params, setParams] = useState({ page: 1, page_size: pageSize, ...initialParams });
  const [data, setData] = useState({ results: [], count: 0, total_pages: 1 });
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const requestId = useRef(0);
  const key = JSON.stringify(params);

  const load = useCallback(async () => {
    if (!enabled) return;
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get(path, JSON.parse(key));
      if (id === requestId.current) {
        setData(
          Array.isArray(result)
            ? { results: result, count: result.length, total_pages: 1 }
            : { results: [], count: 0, total_pages: 1, ...result }
        );
      }
    } catch (err) {
      if (id === requestId.current) {
        setError(err);
        setData({ results: [], count: 0, total_pages: 1 });
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [path, key, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback((patch) => {
    setParams((current) => ({ ...current, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setParams({ page: 1, page_size: pageSize, ...initialParams });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize]);

  const setPage = useCallback((page) => {
    setParams((current) => ({ ...current, page }));
  }, []);

  return {
    data,
    rows: data.results || [],
    count: data.count || 0,
    totalPages: data.total_pages || 1,
    page: data.page || params.page || 1,
    params,
    setParams,
    update,
    reset,
    setPage,
    loading,
    error,
    reload: load,
  };
}

export function useFetch(path, { enabled = true, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const depKey = JSON.stringify(deps);

  const reload = useCallback(async () => {
    if (!enabled || !path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api.get(path));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [path, enabled, depKey]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, loading, error, reload, setData };
}

export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useDebouncedCallback(callback, delay = 350) {
  const timer = useRef(null);
  return useCallback(
    (...args) => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => callback(...args), delay);
    },
    [callback, delay]
  );
}

export function useAsyncAction() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn) => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }, []);
  return [busy, run];
}

export function useReferenceData(flags) {
  const { data: sections = [], loading: sectionsLoading } = useAll(
    "/academics/sections/",
    { ordering: "school_class__level,name" },
    { enabled: Boolean(flags?.sections) }
  );
  const { data: classes = [], loading: classesLoading } = useAll(
    "/academics/classes/",
    { ordering: "level" },
    { enabled: Boolean(flags?.classes) }
  );
  const { data: subjects = [], loading: subjectsLoading } = useAll(
    "/academics/subjects/",
    { ordering: "name" },
    { enabled: Boolean(flags?.subjects) }
  );
  const { data: years = [], loading: yearsLoading } = useAll(
    "/academics/academic-years/",
    { ordering: "-start_date" },
    { enabled: Boolean(flags?.years) }
  );
  const { data: teachers = [], loading: teachersLoading } = useAll(
    "/academics/teachers/",
    { ordering: "user__first_name" },
    { enabled: Boolean(flags?.teachers) }
  );
  const { data: students = [], loading: studentsLoading } = useAll(
    "/academics/students/",
    { ordering: "user__first_name" },
    { enabled: Boolean(flags?.students) }
  );
  const { data: users = [], loading: usersLoading } = useAll(
    "/accounts/users/",
    { ordering: "first_name" },
    { enabled: Boolean(flags?.users) }
  );
  const { data: categories = [], loading: categoriesLoading } = useAll(
    "/finance/fee-categories/",
    { ordering: "name" },
    { enabled: Boolean(flags?.categories) }
  );
  const { data: structures = [], loading: structuresLoading } = useAll(
    "/finance/fee-structures/",
    { ordering: "title" },
    { enabled: Boolean(flags?.structures) }
  );

  return useMemo(
    () => ({
      sections,
      classes,
      subjects,
      years,
      teachers,
      students,
      users,
      categories,
      structures,
      loading:
        sectionsLoading ||
        classesLoading ||
        subjectsLoading ||
        yearsLoading ||
        teachersLoading ||
        studentsLoading ||
        usersLoading ||
        categoriesLoading ||
        structuresLoading,
    }),
    [
      sections,
      classes,
      subjects,
      years,
      teachers,
      students,
      users,
      categories,
      structures,
      sectionsLoading,
      classesLoading,
      subjectsLoading,
      yearsLoading,
      teachersLoading,
      studentsLoading,
      usersLoading,
      categoriesLoading,
      structuresLoading,
    ]
  );
}
