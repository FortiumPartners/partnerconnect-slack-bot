/**
 * Utility functions for formatting data in Slack messages
 */

/**
 * Format currency amount
 */
export function formatCurrency(amount, currencyCode = 'USD') {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return '$0.00';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2
  }).format(amount);
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format large numbers with K/M suffixes
 */
export function formatLargeNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

/**
 * Get urgency level emoji based on days overdue
 */
export function getUrgencyEmoji(daysOverdue) {
  if (daysOverdue >= 90) return '🔴';
  if (daysOverdue >= 60) return '🟠';
  if (daysOverdue >= 30) return '🟡';
  return '🟢';
}

/**
 * Get urgency level text
 */
export function getUrgencyLevel(daysOverdue) {
  if (daysOverdue >= 90) return 'CRITICAL';
  if (daysOverdue >= 60) return 'HIGH';
  if (daysOverdue >= 30) return 'MEDIUM';
  return 'LOW';
}

/**
 * Format date for display
 */
export function formatDate(dateString) {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return dateString;
  }
}

/**
 * Format relative time (e.g., "3 days ago")
 */
export function formatRelativeTime(dateString) {
  if (!dateString) return 'N/A';

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  } catch (error) {
    return dateString;
  }
}

/**
 * Truncate text to specified length with ellipsis
 */
export function truncateText(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Format percentage
 */
export function formatPercentage(value, total) {
  if (total === 0) return '0%';
  const percentage = (value / total) * 100;
  return `${percentage.toFixed(1)}%`;
}

/**
 * Create progress bar using Unicode blocks
 */
export function createProgressBar(value, total, length = 10) {
  if (total === 0) return '▱'.repeat(length);

  const percentage = value / total;
  const filled = Math.round(percentage * length);
  const empty = length - filled;

  return '▰'.repeat(filled) + '▱'.repeat(empty);
}

/**
 * Format duration in human readable format
 */
export function formatDuration(hours) {
  if (!hours || hours === 0) return 'N/A';

  if (hours < 1) {
    return `${Math.round(hours * 60)} minutes`;
  }

  if (hours < 24) {
    return `${hours.toFixed(1)} hours`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;

  if (remainingHours === 0) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  }

  return `${days}d ${remainingHours.toFixed(1)}h`;
}