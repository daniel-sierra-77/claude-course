import { Database } from "sqlite";

export interface OverduePendingOrder {
  order_number: string;
  customer_name: string;
  phone: string | null;
  total_amount: number;
  days_pending: number;
}

export async function getOverduePendingOrders(
  db: Database
): Promise<OverduePendingOrder[]> {
  const rows = await db.all(`
    SELECT
      o.order_number,
      c.first_name || ' ' || c.last_name AS customer_name,
      c.phone,
      o.total_amount,
      CAST(julianday('now') - julianday(o.created_at) AS INTEGER) AS days_pending
    FROM orders o
    JOIN customers c ON c.id = o.customer_id
    WHERE o.status = 'pending'
      AND o.created_at <= datetime('now', '-3 days')
    ORDER BY o.created_at ASC
  `);
  return rows as OverduePendingOrder[];
}
