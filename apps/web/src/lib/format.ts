import { format } from "date-fns";

export function formatDate(value: Date | string | number) {
  return format(new Date(value), "d MMM yyyy");
}

export function formatDateTime(value: Date | string | number) {
  return format(new Date(value), "d MMM yyyy, h:mm a");
}
