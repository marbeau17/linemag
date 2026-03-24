import { getAdminClient } from "@/lib/supabase/admin";

export interface DeliveryLog {
  id: string;
  customerId: string;
  broadcastId: string | null;
  messageType: "broadcast" | "push" | "narrowcast" | "scenario" | "ab_test";
  templateId: string | null;
  status: "sent" | "delivered" | "opened" | "clicked" | "failed";
  metadata: Record<string, unknown>;
  sentAt: string;
}

export interface LogDeliveryInput {
  customerId: string;
  broadcastId?: string;
  messageType: "broadcast" | "push" | "narrowcast" | "scenario" | "ab_test";
  templateId?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

function toDeliveryLog(row: Record<string, unknown>): DeliveryLog {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    broadcastId: (row.broadcast_id as string) ?? null,
    messageType: row.message_type as DeliveryLog["messageType"],
    templateId: (row.template_id as string) ?? null,
    status: row.status as DeliveryLog["status"],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    sentAt: row.sent_at as string,
  };
}

/** Log a single delivery */
export async function logDelivery(input: LogDeliveryInput): Promise<void> {
  const supabase = getAdminClient();

  const row = {
    customer_id: input.customerId,
    broadcast_id: input.broadcastId ?? null,
    message_type: input.messageType,
    template_id: input.templateId ?? null,
    status: input.status ?? "sent",
    metadata: input.metadata ?? {},
    sent_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("delivery_logs")
    .insert(row as never);

  if (error) {
    throw new Error(`Failed to log delivery: ${error.message}`);
  }
}

/** Batch log multiple deliveries */
export async function batchLogDelivery(
  inputs: LogDeliveryInput[]
): Promise<void> {
  const supabase = getAdminClient();

  const now = new Date().toISOString();
  const rows = inputs.map((input) => ({
    customer_id: input.customerId,
    broadcast_id: input.broadcastId ?? null,
    message_type: input.messageType,
    template_id: input.templateId ?? null,
    status: input.status ?? "sent",
    metadata: input.metadata ?? {},
    sent_at: now,
  }));

  const { error } = await supabase
    .from("delivery_logs")
    .insert(rows as never);

  if (error) {
    throw new Error(`Failed to batch log deliveries: ${error.message}`);
  }
}

/** Update the status of a delivery log entry */
export async function updateDeliveryStatus(
  id: string,
  status: string
): Promise<void> {
  const supabase = getAdminClient();

  const { error } = await supabase
    .from("delivery_logs")
    .update({ status } as never)
    .eq("id", id);

  if (error) {
    throw new Error(`Failed to update delivery status: ${error.message}`);
  }
}

/** Get delivery logs with optional filters */
export async function getDeliveryLogs(
  options?: {
    customerId?: string;
    messageType?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }
): Promise<DeliveryLog[]> {
  const supabase = getAdminClient();

  let query = supabase
    .from("delivery_logs")
    .select("*")
    .order("sent_at", { ascending: false });

  if (options?.customerId) {
    query = query.eq("customer_id", options.customerId);
  }
  if (options?.messageType) {
    query = query.eq("message_type", options.messageType);
  }
  if (options?.status) {
    query = query.eq("status", options.status);
  }
  if (options?.dateFrom) {
    query = query.gte("sent_at", options.dateFrom);
  }
  if (options?.dateTo) {
    query = query.lte("sent_at", options.dateTo);
  }

  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get delivery logs: ${error.message}`);
  }

  return (data ?? []).map((row) => toDeliveryLog(row as Record<string, unknown>));
}

/** Get aggregate delivery stats for a date range */
export async function getDeliveryStats(
  dateFrom: string,
  dateTo: string
): Promise<{
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalFailed: number;
  openRate: number;
  clickRate: number;
  byType: Record<string, number>;
}> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("delivery_logs")
    .select("status, message_type")
    .gte("sent_at", dateFrom)
    .lte("sent_at", dateTo);

  if (error) {
    throw new Error(`Failed to get delivery stats: ${error.message}`);
  }

  const rows = data ?? [];

  let totalSent = 0;
  let totalDelivered = 0;
  let totalOpened = 0;
  let totalClicked = 0;
  let totalFailed = 0;
  const byType: Record<string, number> = {};

  for (const row of rows) {
    const status = (row as Record<string, unknown>).status as string;
    const messageType = (row as Record<string, unknown>).message_type as string;

    byType[messageType] = (byType[messageType] ?? 0) + 1;

    switch (status) {
      case "sent":
        totalSent++;
        break;
      case "delivered":
        totalDelivered++;
        break;
      case "opened":
        totalOpened++;
        break;
      case "clicked":
        totalClicked++;
        break;
      case "failed":
        totalFailed++;
        break;
    }
  }

  const totalNonFailed = rows.length - totalFailed;
  const openRate = totalNonFailed > 0 ? totalOpened / totalNonFailed : 0;
  const clickRate = totalNonFailed > 0 ? totalClicked / totalNonFailed : 0;

  return {
    totalSent,
    totalDelivered,
    totalOpened,
    totalClicked,
    totalFailed,
    openRate,
    clickRate,
    byType,
  };
}

/** Get daily delivery counts for charting */
export async function getDailyDeliveryCounts(
  dateFrom: string,
  dateTo: string
): Promise<{ date: string; sent: number; opened: number; clicked: number }[]> {
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("delivery_logs")
    .select("sent_at, status")
    .gte("sent_at", dateFrom)
    .lte("sent_at", dateTo)
    .order("sent_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to get daily delivery counts: ${error.message}`);
  }

  const rows = data ?? [];
  const buckets: Record<string, { sent: number; opened: number; clicked: number }> = {};

  for (const row of rows) {
    const r = row as Record<string, unknown>;
    const date = (r.sent_at as string).slice(0, 10); // YYYY-MM-DD
    const status = r.status as string;

    if (!buckets[date]) {
      buckets[date] = { sent: 0, opened: 0, clicked: 0 };
    }

    if (status === "sent") buckets[date].sent++;
    if (status === "opened") buckets[date].opened++;
    if (status === "clicked") buckets[date].clicked++;
  }

  return Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, counts]) => ({ date, ...counts }));
}
