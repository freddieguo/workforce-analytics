import fs from "fs";
import path from "path";

const DATA_DIR = path.join(
  process.cwd(),
  "data",
  "processed"
);

const DASHBOARD_FILE = path.join(
  DATA_DIR,
  "dashboard.json"
);

export type CsvRow = Record<string, string>;

type Dataset = {
  rows: number;
  columns: string[];
  data: Record<string, unknown>[];
};

type DashboardData = Record<
  string,
  Dataset
>;

let dashboardCache:
  | DashboardData
  | null = null;

/* =========================================================
 * LOAD DASHBOARD JSON
 * ======================================================= */

function loadDashboard(): DashboardData {
  /*
   * Use memory cache after the first load.
   *
   * dashboard.json can be relatively large, so we only
   * read and parse it once per server process.
   */
  if (dashboardCache !== null) {
    return dashboardCache;
  }

  if (!fs.existsSync(DASHBOARD_FILE)) {
    throw new Error(
      `Dashboard data not found: ${DASHBOARD_FILE}`
    );
  }

  console.log(
    "[Workforce Analytics] Loading dashboard.json..."
  );

  const content = fs.readFileSync(
    DASHBOARD_FILE,
    "utf-8"
  );

  const loadedData =
    JSON.parse(content) as DashboardData;

  dashboardCache = loadedData;

  console.log(
    "[Workforce Analytics] Dashboard data loaded."
  );

  return loadedData;
}

/* =========================================================
 * NORMALIZE DATA
 *
 * dashboard.json may contain:
 *
 *   "123"      -> string
 *   123        -> number
 *   null       -> null
 *
 * The existing dashboard pages were originally written
 * against CSV data, where every value was a string.
 *
 * Convert everything back to strings here so all existing
 * pages remain compatible.
 * ======================================================= */

function normalizeRow(
  row: Record<string, unknown>
): CsvRow {
  const normalized: CsvRow = {};

  for (const [key, value] of Object.entries(
    row
  )) {
    if (
      value === null ||
      value === undefined
    ) {
      normalized[key] = "";
    } else {
      normalized[key] = String(value);
    }
  }

  return normalized;
}

/* =========================================================
 * GET DATASET
 * ======================================================= */

function getDataset(
  dashboard: DashboardData,
  name: string
): CsvRow[] {
  const dataset =
    dashboard[name];

  if (!dataset?.data) {
    return [];
  }

  return dataset.data.map(
    normalizeRow
  );
}

/* =========================================================
 * PUBLIC DASHBOARD DATA
 * ======================================================= */

export function getDashboardData() {
  const dashboard =
    loadDashboard();

  return {
    /* =====================================================
     * DEMAND / DISPATCH
     * =================================================== */

    demand: getDataset(
      dashboard,
      "demand"
    ),

    dispatch: getDataset(
      dashboard,
      "dispatch"
    ),

    allocation: getDataset(
      dashboard,
      "supplier_allocation"
    ),

    missingSupplierAllocation:
      getDataset(
        dashboard,
        "missing_supplier_allocation"
      ),

    /* =====================================================
     * ATTENDANCE
     *
     * ot_daily currently contains the attendance-level
     * OT source data in the processed dashboard.
     * =================================================== */

    attendance: getDataset(
      dashboard,
      "ot_daily"
    ),

    /* =====================================================
     * OT
     * =================================================== */

    otDaily: getDataset(
      dashboard,
      "ot_daily"
    ),

    otWarehouse: getDataset(
      dashboard,
      "ot_warehouse"
    ),

    otSupplier: getDataset(
      dashboard,
      "ot_supplier"
    ),

    otJob: getDataset(
      dashboard,
      "ot_job"
    ),

    /* =====================================================
     * SUPPLIER
     * =================================================== */

    supplierSummary: getDataset(
      dashboard,
      "supplier_summary"
    ),

    supplierWarehouse:
      getDataset(
        dashboard,
        "supplier_warehouse"
      ),

    supplierJob: getDataset(
      dashboard,
      "supplier_job"
    ),

    /* =====================================================
     * WAREHOUSE
     * =================================================== */

    warehouseSummary:
      getDataset(
        dashboard,
        "warehouse_summary"
      ),

    warehouseJob: getDataset(
      dashboard,
      "warehouse_job"
    ),

    /* =====================================================
     * TRIAL FAILURE
     * =================================================== */

    /*
     * Keep the existing trialFailure property for
     * compatibility with existing pages.
     *
     * The current dashboard.json contains the processed
     * dataset under:
     *
     *   trial_failure_daily
     */

    trialFailure: getDataset(
      dashboard,
      "trial_failure_daily"
    ),

    /*
     * Explicit daily dataset.
     *
     * This fixes pages using:
     *
     *   data.trialFailureDaily
     */

    trialFailureDaily:
      getDataset(
        dashboard,
        "trial_failure_daily"
      ),

    trialFailureSupplier:
      getDataset(
        dashboard,
        "trial_failure_supplier"
      ),

    trialFailureWarehouse:
      getDataset(
        dashboard,
        "trial_failure_warehouse"
      ),

    trialFailureJob:
      getDataset(
        dashboard,
        "trial_failure_job"
      ),

    /* =====================================================
     * TRIAL FAILURE REFERENCE
     * =================================================== */

    trialFailureSupplierReference:
      getDataset(
        dashboard,
        "trial_failure_supplier_reference"
      ),

    trialFailureWarehouseReference:
      getDataset(
        dashboard,
        "trial_failure_warehouse_reference"
      ),

    trialFailureJobReference:
      getDataset(
        dashboard,
        "trial_failure_job_reference"
      ),


      arrivalDaily: getDataset(dashboard, "arrival_daily"),
      arrivalSupplier: getDataset(dashboard, "arrival_supplier"),
      arrivalWarehouse: getDataset(dashboard, "arrival_warehouse"),
      arrivalSummary: getDataset(dashboard, "arrival_summary"),
      
      acceptanceSummary: getDataset(dashboard, "acceptance_summary"),

      arrivalTrackingSummary: getDataset(dashboard, "arrival_tracking_summary"),
      arrivalTrackingWarehouse: getDataset(dashboard, "arrival_tracking_warehouse"),
      arrivalTrackingReason: getDataset(dashboard, "arrival_tracking_reason"),
      arrivalTrackingDaily: getDataset(dashboard, "arrival_tracking_daily"),
      arrivalTrackingSupplier: getDataset(dashboard, "arrival_tracking_supplier"),

      matchSupplierArrival: getDataset(dashboard, "match_supplier_arrival"),
      matchWarehouseArrival: getDataset(dashboard, "match_warehouse_arrival"),
      warehouseAllocSummary: getDataset(dashboard, "warehouse_alloc_summary"),

      jobAllocSummary: getDataset(dashboard, "job_alloc_summary")


  };
}

/* =========================================================
 * CLEAR CACHE
 *
 * Useful during development after regenerating
 * dashboard.json without restarting Next.js.
 * ======================================================= */

export function clearDashboardCache() {
  dashboardCache = null;
}