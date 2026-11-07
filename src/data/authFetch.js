export function authFetch(url, options = {}) {
  const headers = new Headers(options.headers);
  const token = sessionStorage.getItem("token");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, {
    ...options,
    headers,
  });
}