import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @/lib/supabase/admin
// ---------------------------------------------------------------------------

// Chainable query builder: every method returns `this` so calls can be chained,
// and the terminal awaited call resolves via `then`.
function createQueryBuilder(resolveValue: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const methods = [
    "from",
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "gte",
    "lte",
    "order",
    "limit",
    "range",
    "single",
    "maybeSingle",
  ];

  for (const m of methods) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }

  // Make the builder thenable so `await supabase.from(…).select(…)` resolves.
  builder.then = (resolve: (v: unknown) => void) => resolve(resolveValue);

  return builder;
}

let mockQueryBuilder: ReturnType<typeof createQueryBuilder>;

vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: vi.fn(() => mockQueryBuilder),
}));

// ---------------------------------------------------------------------------
// Imports (must come after vi.mock so the mock is in place)
// ---------------------------------------------------------------------------

import {
  getScenarios,
  getScenarioById,
  createScenario,
  updateScenario,
  deleteScenario,
  logScenarioExecution,
  getScenarioLogs,
} from "@/lib/ma/scenarios";

import {
  getABTests,
  createABTest,
  assignCustomersToTest,
  recordAssignmentEvent,
  calculateTestResults,
} from "@/lib/ma/ab-tests";

import {
  logDelivery,
  batchLogDelivery,
  getDeliveryLogs,
  getDeliveryStats,
  getDailyDeliveryCounts,
} from "@/lib/ma/delivery";

// ---------------------------------------------------------------------------
// Helpers – sample DB rows
// ---------------------------------------------------------------------------

const scenarioRow = {
  id: "sc-1",
  name: "Welcome Flow",
  description: "Onboarding scenario",
  trigger_type: "event",
  trigger_config: { eventType: "follow" },
  steps: [{ type: "message", config: { text: "Hello" } }],
  is_active: true,
  target_segment_id: "seg-1",
  stats: { sent: 10, opened: 5, clicked: 2 },
  last_executed_at: "2026-01-01T00:00:00Z",
  created_at: "2025-12-01T00:00:00Z",
  updated_at: "2025-12-15T00:00:00Z",
};

const scenarioLogRow = {
  id: "log-1",
  scenario_id: "sc-1",
  customer_id: "cust-1",
  step_index: 0,
  status: "sent",
  detail: { messageId: "msg-1" },
  executed_at: "2026-01-01T00:00:00Z",
};

const abTestRow = {
  id: "ab-1",
  name: "Subject line test",
  description: "Compare two subjects",
  status: "draft" as const,
  test_type: "content" as const,
  variant_a: { subject: "Hi" },
  variant_b: { subject: "Hello" },
  target_segment_id: null,
  sample_size: 500,
  metric: "open_rate",
  results: {},
  winner: null,
  started_at: null,
  ended_at: null,
  created_at: "2025-12-01T00:00:00Z",
  updated_at: "2025-12-01T00:00:00Z",
};

const deliveryLogRow = {
  id: "dl-1",
  customer_id: "cust-1",
  broadcast_id: "bc-1",
  message_type: "broadcast",
  template_id: "tpl-1",
  status: "sent",
  metadata: {},
  sent_at: "2026-01-10T12:00:00Z",
};

// =========================================================================
// Scenarios
// =========================================================================

describe("MA Scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1
  it("getScenarios returns all scenarios", async () => {
    mockQueryBuilder = createQueryBuilder({
      data: [scenarioRow],
      error: null,
    });

    const result = await getScenarios();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("sc-1");
    expect(result[0].name).toBe("Welcome Flow");
    expect(result[0].triggerType).toBe("event");
    expect(result[0].isActive).toBe(true);
    expect(mockQueryBuilder.from).toHaveBeenCalledWith("ma_scenarios");
    expect(mockQueryBuilder.select).toHaveBeenCalledWith("*");
    expect(mockQueryBuilder.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  // 2
  it("getScenarioById returns scenario with correct mapping", async () => {
    mockQueryBuilder = createQueryBuilder({
      data: scenarioRow,
      error: null,
    });

    const result = await getScenarioById("sc-1");

    expect(result).not.toBeNull();
    expect(result!.id).toBe("sc-1");
    expect(result!.triggerConfig).toEqual({ eventType: "follow" });
    expect(result!.steps).toEqual([
      { type: "message", config: { text: "Hello" } },
    ]);
    expect(result!.stats).toEqual({ sent: 10, opened: 5, clicked: 2 });
    expect(result!.targetSegmentId).toBe("seg-1");
    expect(result!.lastExecutedAt).toBe("2026-01-01T00:00:00Z");
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith("id", "sc-1");
    expect(mockQueryBuilder.single).toHaveBeenCalled();
  });

  // 3
  it("createScenario creates with defaults", async () => {
    mockQueryBuilder = createQueryBuilder({
      data: {
        ...scenarioRow,
        is_active: false,
        stats: { sent: 0, opened: 0, clicked: 0 },
      },
      error: null,
    });

    const result = await createScenario({
      name: "Welcome Flow",
      triggerType: "event",
    });

    expect(result.name).toBe("Welcome Flow");
    expect(mockQueryBuilder.from).toHaveBeenCalledWith("ma_scenarios");
    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Welcome Flow",
        trigger_type: "event",
        is_active: false,
        stats: { sent: 0, opened: 0, clicked: 0 },
        description: null,
        target_segment_id: null,
      })
    );
    expect(mockQueryBuilder.select).toHaveBeenCalledWith("*");
    expect(mockQueryBuilder.single).toHaveBeenCalled();
  });

  // 4
  it("updateScenario updates fields", async () => {
    mockQueryBuilder = createQueryBuilder({
      data: { ...scenarioRow, name: "Updated Flow", is_active: false },
      error: null,
    });

    const result = await updateScenario("sc-1", {
      name: "Updated Flow",
      isActive: false,
    });

    expect(result.name).toBe("Updated Flow");
    expect(result.isActive).toBe(false);
    expect(mockQueryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Updated Flow",
        is_active: false,
      })
    );
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith("id", "sc-1");
  });

  // 5
  it("deleteScenario deletes", async () => {
    mockQueryBuilder = createQueryBuilder({ data: null, error: null });

    await expect(deleteScenario("sc-1")).resolves.toBeUndefined();

    expect(mockQueryBuilder.from).toHaveBeenCalledWith("ma_scenarios");
    expect(mockQueryBuilder.delete).toHaveBeenCalled();
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith("id", "sc-1");
  });

  // 6
  it("logScenarioExecution creates log entry", async () => {
    mockQueryBuilder = createQueryBuilder({ data: null, error: null });

    await expect(
      logScenarioExecution("sc-1", "cust-1", 0, "sent", { messageId: "m1" })
    ).resolves.toBeUndefined();

    expect(mockQueryBuilder.from).toHaveBeenCalledWith("ma_scenario_logs");
    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        scenario_id: "sc-1",
        customer_id: "cust-1",
        step_index: 0,
        status: "sent",
        detail: { messageId: "m1" },
      })
    );
  });

  // 7
  it("getScenarioLogs returns logs for scenario", async () => {
    mockQueryBuilder = createQueryBuilder({
      data: [scenarioLogRow],
      error: null,
    });

    const result = await getScenarioLogs("sc-1");

    expect(result).toHaveLength(1);
    expect(result[0].scenarioId).toBe("sc-1");
    expect(result[0].customerId).toBe("cust-1");
    expect(result[0].stepIndex).toBe(0);
    expect(result[0].status).toBe("sent");
    expect(mockQueryBuilder.from).toHaveBeenCalledWith("ma_scenario_logs");
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith("scenario_id", "sc-1");
    expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
  });
});

// =========================================================================
// A/B Tests
// =========================================================================

describe("MA A/B Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 8
  it("getABTests returns all tests", async () => {
    mockQueryBuilder = createQueryBuilder({
      data: [abTestRow],
      error: null,
    });

    const result = await getABTests();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("ab-1");
    expect(result[0].testType).toBe("content");
    expect(result[0].status).toBe("draft");
    expect(mockQueryBuilder.from).toHaveBeenCalledWith("ab_tests");
    expect(mockQueryBuilder.select).toHaveBeenCalledWith("*");
  });

  // 9
  it("createABTest creates test", async () => {
    mockQueryBuilder = createQueryBuilder({
      data: abTestRow,
      error: null,
    });

    const result = await createABTest({
      name: "Subject line test",
      testType: "content",
      variantA: { subject: "Hi" },
      variantB: { subject: "Hello" },
    });

    expect(result.name).toBe("Subject line test");
    expect(result.variantA).toEqual({ subject: "Hi" });
    expect(mockQueryBuilder.from).toHaveBeenCalledWith("ab_tests");
    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Subject line test",
        test_type: "content",
        status: "draft",
        sample_size: 1000,
        metric: "open_rate",
      })
    );
  });

  // 10
  it("assignCustomersToTest assigns A/B variants", async () => {
    mockQueryBuilder = createQueryBuilder({ data: null, error: null });

    // Seed Math.random so we get deterministic variants
    const randomSpy = vi.spyOn(Math, "random");
    randomSpy.mockReturnValueOnce(0.3).mockReturnValueOnce(0.7);

    await assignCustomersToTest("ab-1", ["cust-1", "cust-2"]);

    expect(mockQueryBuilder.from).toHaveBeenCalledWith("ab_test_assignments");
    expect(mockQueryBuilder.insert).toHaveBeenCalledWith([
      { ab_test_id: "ab-1", customer_id: "cust-1", variant: "A" },
      { ab_test_id: "ab-1", customer_id: "cust-2", variant: "B" },
    ]);

    randomSpy.mockRestore();
  });

  // 11
  it("recordAssignmentEvent records event timestamp", async () => {
    mockQueryBuilder = createQueryBuilder({ data: null, error: null });

    await recordAssignmentEvent("assign-1", "opened");

    expect(mockQueryBuilder.from).toHaveBeenCalledWith("ab_test_assignments");
    expect(mockQueryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        opened_at: expect.any(String),
      })
    );
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith("id", "assign-1");
  });

  // 12
  it("calculateTestResults computes rates and winner", async () => {
    // First call: fetch assignments; second call: update ab_tests.
    // Both use the same builder, but `from` is called twice.
    const assignmentRows = [
      {
        id: "a1",
        ab_test_id: "ab-1",
        customer_id: "c1",
        variant: "A",
        delivered_at: "2026-01-01",
        opened_at: "2026-01-01",
        clicked_at: null,
        converted_at: "2026-01-02",
        created_at: "2026-01-01",
      },
      {
        id: "a2",
        ab_test_id: "ab-1",
        customer_id: "c2",
        variant: "A",
        delivered_at: "2026-01-01",
        opened_at: null,
        clicked_at: null,
        converted_at: null,
        created_at: "2026-01-01",
      },
      {
        id: "a3",
        ab_test_id: "ab-1",
        customer_id: "c3",
        variant: "B",
        delivered_at: "2026-01-01",
        opened_at: "2026-01-01",
        clicked_at: "2026-01-01",
        converted_at: "2026-01-02",
        created_at: "2026-01-01",
      },
      {
        id: "a4",
        ab_test_id: "ab-1",
        customer_id: "c4",
        variant: "B",
        delivered_at: "2026-01-01",
        opened_at: "2026-01-01",
        clicked_at: "2026-01-01",
        converted_at: "2026-01-02",
        created_at: "2026-01-01",
      },
    ];

    mockQueryBuilder = createQueryBuilder({
      data: assignmentRows,
      error: null,
    });

    const result = await calculateTestResults("ab-1");

    // Variant A: 2 total, 1 converted => rate 0.5
    expect(result.variantA.total).toBe(2);
    expect(result.variantA.delivered).toBe(2);
    expect(result.variantA.opened).toBe(1);
    expect(result.variantA.converted).toBe(1);
    expect(result.variantA.rate).toBe(0.5);

    // Variant B: 2 total, 2 converted => rate 1.0
    expect(result.variantB.total).toBe(2);
    expect(result.variantB.converted).toBe(2);
    expect(result.variantB.rate).toBe(1.0);

    // Difference 0.5 > 0.05 => significant, winner B
    expect(result.isSignificant).toBe(true);
    expect(result.winner).toBe("B");
  });
});

// =========================================================================
// Delivery
// =========================================================================

describe("MA Delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 13
  it("logDelivery creates delivery log", async () => {
    mockQueryBuilder = createQueryBuilder({ data: null, error: null });

    await expect(
      logDelivery({
        customerId: "cust-1",
        broadcastId: "bc-1",
        messageType: "broadcast",
        templateId: "tpl-1",
      })
    ).resolves.toBeUndefined();

    expect(mockQueryBuilder.from).toHaveBeenCalledWith("delivery_logs");
    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: "cust-1",
        broadcast_id: "bc-1",
        message_type: "broadcast",
        template_id: "tpl-1",
        status: "sent",
      })
    );
  });

  // 14
  it("batchLogDelivery creates multiple logs", async () => {
    mockQueryBuilder = createQueryBuilder({ data: null, error: null });

    await expect(
      batchLogDelivery([
        { customerId: "cust-1", messageType: "broadcast" },
        { customerId: "cust-2", messageType: "push" },
      ])
    ).resolves.toBeUndefined();

    expect(mockQueryBuilder.from).toHaveBeenCalledWith("delivery_logs");
    expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          customer_id: "cust-1",
          message_type: "broadcast",
          status: "sent",
        }),
        expect.objectContaining({
          customer_id: "cust-2",
          message_type: "push",
          status: "sent",
        }),
      ])
    );
  });

  // 15
  it("getDeliveryLogs returns filtered logs", async () => {
    mockQueryBuilder = createQueryBuilder({
      data: [deliveryLogRow],
      error: null,
    });

    const result = await getDeliveryLogs({
      customerId: "cust-1",
      messageType: "broadcast",
      status: "sent",
      dateFrom: "2026-01-01",
      dateTo: "2026-01-31",
      limit: 10,
      offset: 0,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("dl-1");
    expect(result[0].customerId).toBe("cust-1");
    expect(result[0].messageType).toBe("broadcast");
    expect(mockQueryBuilder.from).toHaveBeenCalledWith("delivery_logs");
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith("customer_id", "cust-1");
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith(
      "message_type",
      "broadcast"
    );
    expect(mockQueryBuilder.eq).toHaveBeenCalledWith("status", "sent");
    expect(mockQueryBuilder.gte).toHaveBeenCalledWith(
      "sent_at",
      "2026-01-01"
    );
    expect(mockQueryBuilder.lte).toHaveBeenCalledWith(
      "sent_at",
      "2026-01-31"
    );
    expect(mockQueryBuilder.range).toHaveBeenCalledWith(0, 9);
  });

  // 16
  it("getDeliveryStats calculates rates", async () => {
    mockQueryBuilder = createQueryBuilder({
      data: [
        { status: "sent", message_type: "broadcast" },
        { status: "delivered", message_type: "broadcast" },
        { status: "opened", message_type: "push" },
        { status: "clicked", message_type: "push" },
        { status: "failed", message_type: "broadcast" },
      ],
      error: null,
    });

    const result = await getDeliveryStats("2026-01-01", "2026-01-31");

    expect(result.totalSent).toBe(1);
    expect(result.totalDelivered).toBe(1);
    expect(result.totalOpened).toBe(1);
    expect(result.totalClicked).toBe(1);
    expect(result.totalFailed).toBe(1);
    // totalNonFailed = 5 - 1 = 4
    expect(result.openRate).toBe(1 / 4);
    expect(result.clickRate).toBe(1 / 4);
    expect(result.byType).toEqual({ broadcast: 3, push: 2 });
  });

  // 17
  it("getDailyDeliveryCounts returns daily counts", async () => {
    mockQueryBuilder = createQueryBuilder({
      data: [
        { sent_at: "2026-01-10T08:00:00Z", status: "sent" },
        { sent_at: "2026-01-10T09:00:00Z", status: "opened" },
        { sent_at: "2026-01-11T10:00:00Z", status: "clicked" },
        { sent_at: "2026-01-11T11:00:00Z", status: "sent" },
      ],
      error: null,
    });

    const result = await getDailyDeliveryCounts("2026-01-10", "2026-01-11");

    expect(result).toEqual([
      { date: "2026-01-10", sent: 1, opened: 1, clicked: 0 },
      { date: "2026-01-11", sent: 1, opened: 0, clicked: 1 },
    ]);

    expect(mockQueryBuilder.from).toHaveBeenCalledWith("delivery_logs");
    expect(mockQueryBuilder.gte).toHaveBeenCalledWith(
      "sent_at",
      "2026-01-10"
    );
    expect(mockQueryBuilder.lte).toHaveBeenCalledWith(
      "sent_at",
      "2026-01-11"
    );
    expect(mockQueryBuilder.order).toHaveBeenCalledWith("sent_at", {
      ascending: true,
    });
  });
});
