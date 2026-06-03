import type { OverduePendingOrder } from "./queries/order_alerts_queries.js";

export async function sendOrderAlerts(orders: OverduePendingOrder[]): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("SLACK_WEBHOOK_URL environment variable is not set");
  }

  const blocks: object[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `⚠️ ${orders.length} order(s) pending for more than 3 days`,
      },
    },
  ];

  for (const order of orders) {
    blocks.push(
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Order:*\n#${order.order_number}` },
          { type: "mrkdwn", text: `*Days Pending:*\n${order.days_pending}` },
          { type: "mrkdwn", text: `*Customer:*\n${order.customer_name}` },
          { type: "mrkdwn", text: `*Phone:*\n${order.phone ?? "N/A"}` },
          { type: "mrkdwn", text: `*Amount:*\n$${order.total_amount.toFixed(2)}` },
        ],
      },
      { type: "divider" }
    );
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Slack webhook failed: ${response.status} ${body}`);
  }
}
