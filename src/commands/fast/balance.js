import { formatCurrency, daysBetween } from '../../utils/formatting.js';

/**
 * Fast Balance Command - Direct API implementation
 * Returns outstanding balance with aging analysis
 */
export async function handleBalanceCommand(apiClient, userToken, args = {}) {
  try {
    // Get unpaid invoices directly from API
    const params = new URLSearchParams();
    params.append('Paid', 'false');

    if (args.clientName) {
      params.append('ClientName', args.clientName);
    }

    const invoices = await apiClient.get(`/invoices?${params.toString()}`, userToken);

    if (!invoices || invoices.length === 0) {
      return {
        text: "🎉 No outstanding invoices found!",
        blocks: [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: "🎉 *Outstanding Balance: $0.00*\n\nNo unpaid invoices found."
          }
        }]
      };
    }

    // Calculate aging buckets
    const now = new Date().toISOString().split('T')[0];
    const aging = {
      current: { amount: 0, count: 0 },
      days31to60: { amount: 0, count: 0 },
      days61to90: { amount: 0, count: 0 },
      over90: { amount: 0, count: 0 }
    };

    let totalOutstanding = 0;
    const topInvoices = [];

    for (const invoice of invoices) {
      const outstandingAmount = invoice.Balance || 0;
      totalOutstanding += outstandingAmount;

      // Calculate days overdue
      let daysOverdue = 0;
      if (invoice.DueDate) {
        const daysPastDue = daysBetween(invoice.DueDate, now);
        if (new Date(invoice.DueDate) < new Date(now)) {
          daysOverdue = daysPastDue;
        }
      }

      // Categorize by aging
      if (daysOverdue <= 30) {
        aging.current.amount += outstandingAmount;
        aging.current.count++;
      } else if (daysOverdue <= 60) {
        aging.days31to60.amount += outstandingAmount;
        aging.days31to60.count++;
      } else if (daysOverdue <= 90) {
        aging.days61to90.amount += outstandingAmount;
        aging.days61to90.count++;
      } else {
        aging.over90.amount += outstandingAmount;
        aging.over90.count++;
      }

      // Collect top invoices
      if (outstandingAmount > 0) {
        topInvoices.push({
          clientName: invoice.ClientName || 'Unknown Client',
          amount: outstandingAmount,
          daysOverdue,
          dueDate: invoice.DueDate || invoice.InvoiceDate
        });
      }
    }

    // Sort by amount
    topInvoices.sort((a, b) => b.amount - a.amount);

    // Build response
    const criticalCount = aging.over90.count;
    const urgencyEmoji = criticalCount > 0 ? "🚨" : (aging.days61to90.count > 0 ? "⚠️" : "💰");

    let summaryText = `${urgencyEmoji} *Outstanding Balance: ${formatCurrency(totalOutstanding)}*\n`;
    summaryText += `📊 Total: ${invoices.length} invoices\n\n`;

    summaryText += `📅 *Aging Breakdown:*\n`;
    summaryText += `• Current (0-30 days): ${formatCurrency(aging.current.amount)} (${aging.current.count} invoices)\n`;
    summaryText += `• 31-60 days: ${formatCurrency(aging.days31to60.amount)} (${aging.days31to60.count} invoices)\n`;
    summaryText += `• 61-90 days: ${formatCurrency(aging.days61to90.amount)} (${aging.days61to90.count} invoices)\n`;
    summaryText += `• Over 90 days: ${formatCurrency(aging.over90.amount)} (${aging.over90.count} invoices)\n`;

    const blocks = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: summaryText
        }
      }
    ];

    // Add top invoices
    if (topInvoices.length > 0) {
      let topText = "\n🔝 *Top Outstanding Invoices:*\n";
      topInvoices.slice(0, 5).forEach((invoice, i) => {
        const overdueText = invoice.daysOverdue > 0 ? ` (${invoice.daysOverdue} days overdue)` : '';
        topText += `${i + 1}. ${invoice.clientName}: ${formatCurrency(invoice.amount)}${overdueText}\n`;
      });

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: topText
        }
      });
    }

    // Add urgency alert
    if (criticalCount > 0) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🚨 *URGENT:* ${criticalCount} invoice(s) over 90 days overdue requiring immediate attention!`
        }
      });
    }

    // Add action buttons
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "View Critical Items" },
          style: criticalCount > 0 ? "danger" : "primary",
          action_id: "view_overdue_critical"
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Analyze Trends" },
          action_id: "analyze_collections"
        }
      ]
    });

    return {
      text: `Outstanding Balance: ${formatCurrency(totalOutstanding)}`,
      blocks
    };

  } catch (error) {
    console.error('Balance command error:', error);

    return {
      text: "❌ Error retrieving balance information",
      blocks: [{
        type: "section",
        text: {
          type: "mrkdwn",
          text: `❌ *Error retrieving balance*\n\n${error.message}`
        }
      }]
    };
  }
}

/**
 * Parse balance command arguments
 */
export function parseBalanceArgs(text) {
  const args = {};

  // Extract client name if specified
  const clientMatch = text.match(/(?:for|client)\s+([^,\n]+)/i);
  if (clientMatch) {
    args.clientName = clientMatch[1].trim();
  }

  return args;
}