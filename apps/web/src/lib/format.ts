import { format, formatDistanceToNow } from "date-fns";

export function formatDate(value: Date | string | number) {
  return format(new Date(value), "d MMM yyyy");
}

export function formatDateTime(value: Date | string | number) {
  return format(new Date(value), "d MMM yyyy, h:mm a");
}

export function formatRelativeToNow(value: Date | string | number) {
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

/**
 * Start of "today" in the device's own local timezone. The server only ever
 * sees UTC instants and has no reliable way to know the caller's timezone,
 * so "today" boundaries for day-bucketed queries are resolved here \u2014 on
 * the client, from the device's local clock \u2014 and passed to the API as a
 * plain UTC instant it can compare against.
 */
export function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}
