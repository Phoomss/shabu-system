// NEXT_PUBLIC values are compiled into the browser bundle, not read from Docker runtime env.
export function apiUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL)
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  if (typeof window === "undefined") return "http://127.0.0.1:3000";
  const url = new URL(window.location.origin);
  url.port = "3000";
  return url.origin;
}
export function socketUrl(): string {
  return process.env.NEXT_PUBLIC_SOCKET_URL?.replace(/\/$/, "") || apiUrl();
}
export function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    (typeof window === "undefined" ? "" : window.location.origin)
  );
}
