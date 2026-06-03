import { open } from "sqlite";
import sqlite3 from "sqlite3";

import { createSchema } from "./schema";
import { getOverduePendingOrders } from "./queries/order_alerts_queries.js";
import { sendOrderAlerts } from "./slack.js";

async function main() {
  const db = await open({
    filename: "ecommerce.db",
    driver: sqlite3.Database,
  });

  await createSchema(db, false);

  const overdueOrders = await getOverduePendingOrders(db);

  if (overdueOrders.length === 0) {
    console.log("No orders have been pending longer than 3 days.");
    return;
  }

  console.log(`Sending alert for ${overdueOrders.length} overdue order(s).`);
  await sendOrderAlerts(overdueOrders);
  console.log("Alert sent to #order-alerts.");
}

main();
