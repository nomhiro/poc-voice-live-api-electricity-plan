/**
 * 電力会社カスタマーサポートシステム - 型定義
 */

// =====================
// Customer（顧客・契約情報）
// =====================
export interface Customer {
  id: string;                    // customerId と同一
  customerId: string;            // パーティションキー 例: "C-001"
  customerName: string;          // 契約者名
  customerNameKana: string;      // カナ
  phone: string;                 // 電話番号
  phoneLastFour: string;         // 下4桁（検索用）
  email: string;
  address: {
    postalCode: string;
    prefecture: string;
    city: string;
    street: string;
  };
  contract: {
    contractId: string;
    planId: string;
    planName: string;
    contractedAmperage: number;  // 30, 40, 50, 60
    contractStartDate: string;
    supplyPointId: string;       // 供給地点特定番号
  };
  meterType: 'smart' | 'standard';
  paymentMethod: {
    type: 'credit_card' | 'bank_transfer' | 'convenience_store';
    lastFourDigits?: string;
    bankName?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// =====================
// Billing（請求履歴）
// =====================
export interface Billing {
  id: string;                    // "B-{customerId}-{YYYYMM}"
  customerId: string;
  billingPeriod: {
    year: number;
    month: number;
    startDate: string;
    endDate: string;
    days: number;
  };
  usage: {
    totalKwh: number;
    tier1Kwh: number;            // 〜120kWh
    tier2Kwh: number;            // 120〜300kWh
    tier3Kwh: number;            // 300kWh〜
  };
  charges: {
    basicCharge: number;
    tier1Charge: number;
    tier2Charge: number;
    tier3Charge: number;
    fuelAdjustment: number;
    renewableEnergy: number;
    subtotal: number;
    tax: number;
    totalAmount: number;
  };
  paymentStatus: 'pending' | 'paid' | 'overdue';
  paymentDueDate: string;
  paidAt?: string;
  planId: string;
  planName: string;
  createdAt: string;
}

// =====================
// CurrentMonthUsage（今月の使用量）
// =====================
export interface CurrentMonthUsage {
  id: string;                    // "CU-{customerId}-{YYYYMM}"
  customerId: string;
  year: number;
  month: number;
  totalKwhToDate: number;
  daysElapsed: number;
  estimatedMonthlyKwh: number;
  estimatedMonthlyCharge: number;
  lastUpdated: string;
}

// =====================
// ElectricityPlan（料金プラン）
// =====================
export interface ElectricityPlan {
  id: string;                    // "plan-standard-b"
  planType: string;              // パーティションキー
  planName: string;
  description: string;
  targetCustomer: string;
  availableAmperages: number[];
  pricing: {
    basicCharges: Array<{ amperage: number; monthlyCharge: number }>;
    unitPrices: {
      tier1: { upToKwh: number; pricePerKwh: number };
      tier2: { upToKwh: number; pricePerKwh: number };
      tier3: { upToKwh: number | null; pricePerKwh: number };
    };
    timeOfUsePricing?: {
      peakPrice: number;
      offPeakPrice: number;
      peakHours: string;
    };
  };
  benefits: string[];
  minimumContractPeriod?: number;
  earlyTerminationFee?: number;
  isAvailable: boolean;
  effectiveFrom: string;
  createdAt?: string;
  updatedAt?: string;
}

// =====================
// PlanChangeRequest（プラン変更申請）
// =====================
export interface PlanChangeRequest {
  id: string;                    // "PCR-{customerId}-{timestamp}"
  customerId: string;
  currentPlan: {
    planId: string;
    planName: string;
    amperage: number;
  };
  requestedPlan: {
    planId: string;
    planName: string;
    amperage: number;
  };
  simulation?: {
    estimatedMonthlySaving: number;
    estimatedAnnualSaving: number;
  };
  status: 'pending' | 'approved' | 'processing' | 'completed' | 'rejected';
  requestedEffectiveDate: string;
  actualEffectiveDate?: string;
  createdAt: string;
  updatedAt: string;
}

// =====================
// API レスポンス型
// =====================

// get_customer_info
export interface CustomerInfoResponse {
  success: true;
  customer: {
    customerId: string;
    customerName: string;
    customerNameKana: string;
    phone: string;              // マスク済み "****-****-1234"
    email: string;
    address: string;            // フォーマット済み
    contract: {
      contractId: string;
      planId: string;
      planName: string;
      contractedAmperage: number;
      contractStartDate: string;
    };
    meterType: 'smart' | 'standard';
    paymentMethod: string;       // フォーマット済み
  };
}

// get_billing_history
export interface BillingHistoryResponse {
  success: true;
  customerId: string;
  billings: Array<{
    billingMonth: string;        // "2024年11月"
    usageKwh: number;
    basicCharge: number;
    usageCharge: number;
    fuelAdjustment: number;
    renewableEnergy: number;
    totalAmount: number;
    paymentStatus: 'pending' | 'paid' | 'overdue';
    paymentDueDate: string;
  }>;
  summary: {
    totalMonths: number;
    averageUsageKwh: number;
    averageAmount: number;
  };
}

// get_current_usage
export interface CurrentUsageResponse {
  success: true;
  customerId: string;
  currentMonth: string;          // "2024年11月"
  usage: {
    totalKwhToDate: number;
    daysElapsed: number;
    estimatedMonthlyKwh: number;
    comparisonWithLastMonth: string;  // "+10%" or "-5%"
  };
  estimatedBill: {
    estimatedAmount: number;
    breakdown: {
      basicCharge: number;
      usageCharge: number;
      fuelAdjustment: number;
      renewableEnergy: number;
    };
  };
  lastUpdated: string;
}

// list_available_plans
export interface AvailablePlansResponse {
  success: true;
  currentPlanId?: string;
  plans: Array<{
    planId: string;
    planName: string;
    planType: string;
    description: string;
    targetCustomer: string;
    basicCharges: Array<{ amperage: number; monthlyCharge: number }>;
    unitPrices: {
      tier1: string;             // "〜120kWh: 19.88円/kWh"
      tier2: string;             // "120〜300kWh: 26.46円/kWh"
      tier3: string;             // "300kWh〜: 30.57円/kWh"
    };
    benefits: string[];
    minimumContractPeriod?: number;
    earlyTerminationFee?: number;
    isRecommended?: boolean;
  }>;
}

// simulate_plan_change
export interface SimulationResponse {
  success: true;
  customerId: string;
  currentPlan: {
    planId: string;
    planName: string;
  };
  newPlan: {
    planId: string;
    planName: string;
  };
  simulation: {
    monthlyComparison: Array<{
      month: string;             // "2024年10月"
      usageKwh: number;
      currentPlanAmount: number;
      newPlanAmount: number;
      difference: number;        // +なら値上がり、-なら値下がり
    }>;
    summary: {
      averageMonthlyDifference: number;
      estimatedAnnualSaving: number;
      savingsPercent: number;
    };
  };
  notes: string[];               // 注意事項
}

// submit_plan_change_request
export interface PlanChangeSubmitResponse {
  success: true;
  requestId: string;
  customerId: string;
  changeDetails: {
    currentPlanName: string;
    newPlanName: string;
    effectiveDate: string;
    submittedAt: string;
  };
  message: string;
  nextSteps: string[];
}

// Error Response
export interface ErrorResponse {
  success: false;
  error: string;
  errorCode: 'CUSTOMER_NOT_FOUND' | 'VERIFICATION_FAILED' | 'INVALID_INPUT' | 'PLAN_NOT_FOUND' | 'SMART_METER_NOT_AVAILABLE' | 'SYSTEM_ERROR';
}


// =====================
// Conversation Email（会話メール送信）
// =====================
export interface TranscriptMessage {
  id: string;
  speaker: 'user' | 'assistant';
  text: string;
}

export interface ConversationEmailRequest {
  customerId: string;
  customerEmail: string;
  customerName: string;
  transcript: TranscriptMessage[];
}

export interface ConversationEmailResponse {
  success: boolean;
  message: string;
  sentTo?: string;
  skipped?: boolean;
}
