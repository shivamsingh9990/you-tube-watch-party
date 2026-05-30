const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export function getApiUrl(path = "") {
  const base = API_URL.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

export { API_URL };
