import { differenceInSeconds } from 'date-fns/differenceInSeconds';
import { format } from 'date-fns/format';

/**
 * Format date to "MMM d, yyyy" format
 */
export function formatBookingDate(date: string | Date): string {
  return format(new Date(date), 'MMM d, yyyy');
}

/**
 * Format time to "h:mm a" format
 */
export function formatBookingTime(date: string | Date): string {
  return format(new Date(date), 'h:mm a');
}

/**
 * Calculate elapsed time since booking was created
 * Returns format like "5m 23s ago"
 */
export function getElapsedTime(createdAt: string | Date): string {
  const now = new Date();
  const created = new Date(createdAt);
  const secondsElapsed = differenceInSeconds(now, created);

  if (secondsElapsed < 60) {
    return `${secondsElapsed}s ago`;
  } else if (secondsElapsed < 3600) {
    const minutes = Math.floor(secondsElapsed / 60);
    const seconds = secondsElapsed % 60;
    return `${minutes}m ${seconds}s ago`;
  } else if (secondsElapsed < 86400) {
    const hours = Math.floor(secondsElapsed / 3600);
    const minutes = Math.floor((secondsElapsed % 3600) / 60);
    return `${hours}h ${minutes}m ago`;
  } else {
    const days = Math.floor(secondsElapsed / 86400);
    return `${days}d ago`;
  }
}

/**
 * Get status display name
 */
export function getStatusDisplayName(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled_by_customer: 'Cancelled by Customer',
    cancelled_by_user: 'Cancelled by Customer',
    cancelled_by_restaurant: 'Cancelled by Restaurant',
    declined_by_restaurant: 'Declined',
    no_show: 'No Show',
  };
  return statusMap[status] || status;
}

/**
 * Get status color
 */
export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    pending: '#f97316', // orange
    confirmed: '#16a34a', // green
    completed: '#2563eb', // blue
    cancelled_by_customer: '#6b7280', // gray
    cancelled_by_user: '#6b7280', // gray
    cancelled_by_restaurant: '#6b7280', // gray
    declined_by_restaurant: '#dc2626', // red
    no_show: '#dc2626', // red
  };
  return colorMap[status] || '#6b7280';
}

