/**
 * 電力会社カスタマーサポートシステム - サンプルデータ
 */

import type { Customer, Billing, CurrentMonthUsage, ElectricityPlan, PlanChangeRequest } from './types';

// =====================
// 顧客サンプルデータ
// =====================
export const sampleCustomers: Customer[] = [
  {
    id: 'C-001',
    customerId: 'C-001',
    customerName: '野村宏樹',
    customerNameKana: 'ノムラヒロキ',
    phone: '03-1234-5678',
    phoneLastFour: '5678',
    email: 'nomura@example.com',
    address: {
      postalCode: '100-0001',
      prefecture: '東京都',
      city: '千代田区',
      street: '千代田1-1-1'
    },
    contract: {
      contractId: 'CT-2023-001',
      planId: 'plan-standard-b',
      planName: '従量電灯B',
      contractedAmperage: 50,
      contractStartDate: '2023-04-01',
      supplyPointId: '0312345678901234567890'
    },
    meterType: 'smart',
    paymentMethod: {
      type: 'credit_card',
      lastFourDigits: '1234'
    },
    createdAt: '2023-04-01T00:00:00Z',
    updatedAt: '2024-11-01T00:00:00Z'
  },
  {
    id: 'C-002',
    customerId: 'C-002',
    customerName: '佐藤花子',
    customerNameKana: 'サトウハナコ',
    phone: '06-9876-5432',
    phoneLastFour: '5432',
    email: 'sato@example.com',
    address: {
      postalCode: '530-0001',
      prefecture: '大阪府',
      city: '大阪市北区',
      street: '梅田2-2-2'
    },
    contract: {
      contractId: 'CT-2022-015',
      planId: 'plan-smart-eco',
      planName: 'スマートエコプラン',
      contractedAmperage: 50,
      contractStartDate: '2022-08-01',
      supplyPointId: '0698765432109876543210'
    },
    meterType: 'smart',
    paymentMethod: {
      type: 'bank_transfer',
      bankName: 'みずほ銀行'
    },
    createdAt: '2022-08-01T00:00:00Z',
    updatedAt: '2024-10-15T00:00:00Z'
  },
  {
    id: 'C-003',
    customerId: 'C-003',
    customerName: '鈴木一郎',
    customerNameKana: 'スズキイチロウ',
    phone: '052-1111-2222',
    phoneLastFour: '2222',
    email: 'suzuki@example.com',
    address: {
      postalCode: '460-0001',
      prefecture: '愛知県',
      city: '名古屋市中区',
      street: '栄3-3-3'
    },
    contract: {
      contractId: 'CT-2024-003',
      planId: 'plan-standard-b',
      planName: '従量電灯B',
      contractedAmperage: 30,
      contractStartDate: '2024-01-15',
      supplyPointId: '0521111222233334444555'
    },
    meterType: 'standard',
    paymentMethod: {
      type: 'convenience_store'
    },
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-11-20T00:00:00Z'
  }
];

// =====================
// 請求履歴サンプルデータ（過去6ヶ月分）
// =====================
function generateBillings(customerId: string, planId: string, planName: string, amperage: number): Billing[] {
  const billings: Billing[] = [];
  const now = new Date();

  // 基本料金テーブル
  const basicChargeTable: Record<number, number> = {
    30: 885,
    40: 1180,
    50: 1476,
    60: 1771
  };

  for (let i = 1; i <= 6; i++) {
    const billingDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = billingDate.getFullYear();
    const month = billingDate.getMonth() + 1;

    // 使用量のランダム生成（季節変動を考慮）
    // C-001（野村宏樹）は大家族で使用量が多い設定
    const isHighUsageCustomer = customerId === 'C-001';
    const baseUsage = isHighUsageCustomer ? 400 + Math.floor(Math.random() * 100) : 250 + Math.floor(Math.random() * 100);
    const seasonalFactor = month >= 7 && month <= 9 ? 1.3 : (month >= 12 || month <= 2 ? 1.2 : 1.0);
    const totalKwh = Math.floor(baseUsage * seasonalFactor);

    // 3段階料金計算
    const tier1Kwh = Math.min(totalKwh, 120);
    const tier2Kwh = Math.min(Math.max(totalKwh - 120, 0), 180);
    const tier3Kwh = Math.max(totalKwh - 300, 0);

    const tier1Charge = Math.floor(tier1Kwh * 19.88);
    const tier2Charge = Math.floor(tier2Kwh * 26.46);
    const tier3Charge = Math.floor(tier3Kwh * 30.57);

    const basicCharge = basicChargeTable[amperage] || 1180;
    const fuelAdjustment = Math.floor(totalKwh * -0.8); // 燃料費調整額（マイナス想定）
    const renewableEnergy = Math.floor(totalKwh * 1.4); // 再エネ賦課金

    const subtotal = basicCharge + tier1Charge + tier2Charge + tier3Charge + fuelAdjustment + renewableEnergy;
    const tax = Math.floor(subtotal * 0.1);
    const totalAmount = subtotal + tax;

    const isPaid = i > 1; // 先月分以降は支払い済み

    billings.push({
      id: `B-${customerId}-${year}${month.toString().padStart(2, '0')}`,
      customerId,
      billingPeriod: {
        year,
        month,
        startDate: `${year}-${(month - 1 || 12).toString().padStart(2, '0')}-15`,
        endDate: `${year}-${month.toString().padStart(2, '0')}-14`,
        days: 30
      },
      usage: {
        totalKwh,
        tier1Kwh,
        tier2Kwh,
        tier3Kwh
      },
      charges: {
        basicCharge,
        tier1Charge,
        tier2Charge,
        tier3Charge,
        fuelAdjustment,
        renewableEnergy,
        subtotal,
        tax,
        totalAmount
      },
      paymentStatus: isPaid ? 'paid' : 'pending',
      paymentDueDate: `${year}-${(month + 1).toString().padStart(2, '0')}-10`,
      paidAt: isPaid ? `${year}-${month.toString().padStart(2, '0')}-25T10:00:00Z` : undefined,
      planId,
      planName,
      createdAt: `${year}-${month.toString().padStart(2, '0')}-15T00:00:00Z`
    });
  }

  return billings;
}

export const sampleBillings: Billing[] = [
  ...generateBillings('C-001', 'plan-standard-b', '従量電灯B', 50),
  ...generateBillings('C-002', 'plan-smart-eco', 'スマートエコプラン', 50),
  ...generateBillings('C-003', 'plan-standard-b', '従量電灯B', 30)
];

// =====================
// 今月使用量サンプルデータ
// =====================
const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;
const daysElapsed = now.getDate();

export const sampleCurrentUsages: CurrentMonthUsage[] = [
  {
    id: `CU-C-001-${currentYear}${currentMonth.toString().padStart(2, '0')}`,
    customerId: 'C-001',
    year: currentYear,
    month: currentMonth,
    totalKwhToDate: Math.floor(daysElapsed * 15), // 1日あたり約15kWh（大家族・高使用量）
    daysElapsed,
    estimatedMonthlyKwh: Math.floor(daysElapsed * 15 * 30 / daysElapsed),
    estimatedMonthlyCharge: 13500,
    lastUpdated: now.toISOString()
  },
  {
    id: `CU-C-002-${currentYear}${currentMonth.toString().padStart(2, '0')}`,
    customerId: 'C-002',
    year: currentYear,
    month: currentMonth,
    totalKwhToDate: Math.floor(daysElapsed * 12.5), // 1日あたり約12.5kWh
    daysElapsed,
    estimatedMonthlyKwh: Math.floor(daysElapsed * 12.5 * 30 / daysElapsed),
    estimatedMonthlyCharge: 11200,
    lastUpdated: now.toISOString()
  },
  {
    id: `CU-C-003-${currentYear}${currentMonth.toString().padStart(2, '0')}`,
    customerId: 'C-003',
    year: currentYear,
    month: currentMonth,
    totalKwhToDate: Math.floor(daysElapsed * 7.0), // 1日あたり約7kWh
    daysElapsed,
    estimatedMonthlyKwh: Math.floor(daysElapsed * 7.0 * 30 / daysElapsed),
    estimatedMonthlyCharge: 6200,
    lastUpdated: now.toISOString()
  }
];

// =====================
// 電力プランサンプルデータ
// =====================
export const samplePlans: ElectricityPlan[] = [
  {
    id: 'plan-standard-b',
    planType: '従量電灯',
    planName: '従量電灯B',
    description: '一般家庭向けの標準的な料金プランです。使用量に応じた3段階の料金体系となっています。',
    targetCustomer: '一般家庭向け',
    availableAmperages: [30, 40, 50, 60],
    pricing: {
      basicCharges: [
        { amperage: 30, monthlyCharge: 885 },
        { amperage: 40, monthlyCharge: 1180 },
        { amperage: 50, monthlyCharge: 1476 },
        { amperage: 60, monthlyCharge: 1771 }
      ],
      unitPrices: {
        tier1: { upToKwh: 120, pricePerKwh: 19.88 },
        tier2: { upToKwh: 300, pricePerKwh: 26.46 },
        tier3: { upToKwh: null, pricePerKwh: 30.57 }
      }
    },
    benefits: ['契約期間の縛りなし', '安定した料金体系', '契約変更が容易'],
    isAvailable: true,
    effectiveFrom: '2024-04-01'
  },
  {
    id: 'plan-smart-eco',
    planType: 'スマートプラン',
    planName: 'スマートエコプラン',
    description: '時間帯別料金で、夜間の電気料金がお得になるプランです。オール電化住宅や夜型のライフスタイルの方におすすめです。',
    targetCustomer: 'オール電化・夜型生活向け',
    availableAmperages: [40, 50, 60],
    pricing: {
      basicCharges: [
        { amperage: 40, monthlyCharge: 1210 },
        { amperage: 50, monthlyCharge: 1512 },
        { amperage: 60, monthlyCharge: 1815 }
      ],
      unitPrices: {
        tier1: { upToKwh: 120, pricePerKwh: 20.50 },
        tier2: { upToKwh: 300, pricePerKwh: 27.00 },
        tier3: { upToKwh: null, pricePerKwh: 31.00 }
      },
      timeOfUsePricing: {
        peakPrice: 32.00,
        offPeakPrice: 18.50,
        peakHours: '7:00-23:00'
      }
    },
    benefits: ['夜間電力が約42%お得', 'オール電化住宅に最適', '電気温水器利用者向け'],
    minimumContractPeriod: 12,
    earlyTerminationFee: 2200,
    isAvailable: true,
    effectiveFrom: '2024-04-01'
  },
  {
    id: 'plan-green-plus',
    planType: '再エネプラン',
    planName: 'グリーンプラスプラン',
    description: '再生可能エネルギー100%の電力を供給するプランです。環境に配慮したいお客様におすすめです。',
    targetCustomer: '環境意識の高い方向け',
    availableAmperages: [30, 40, 50, 60],
    pricing: {
      basicCharges: [
        { amperage: 30, monthlyCharge: 980 },
        { amperage: 40, monthlyCharge: 1306 },
        { amperage: 50, monthlyCharge: 1633 },
        { amperage: 60, monthlyCharge: 1960 }
      ],
      unitPrices: {
        tier1: { upToKwh: 120, pricePerKwh: 22.00 },
        tier2: { upToKwh: 300, pricePerKwh: 28.50 },
        tier3: { upToKwh: null, pricePerKwh: 32.50 }
      }
    },
    benefits: ['再エネ100%', 'CO2排出実質ゼロ', '環境貢献証明書発行'],
    minimumContractPeriod: 6,
    isAvailable: true,
    effectiveFrom: '2024-04-01'
  },
  {
    id: 'plan-family-value',
    planType: 'ファミリープラン',
    planName: 'ファミリーバリュープラン',
    description: '電気使用量が多いご家庭向けのプランです。300kWh以上の使用で割引が適用されます。',
    targetCustomer: '大家族・使用量多め向け',
    availableAmperages: [50, 60],
    pricing: {
      basicCharges: [
        { amperage: 50, monthlyCharge: 1540 },
        { amperage: 60, monthlyCharge: 1848 }
      ],
      unitPrices: {
        tier1: { upToKwh: 120, pricePerKwh: 19.88 },
        tier2: { upToKwh: 300, pricePerKwh: 26.46 },
        tier3: { upToKwh: null, pricePerKwh: 28.00 }
      }
    },
    benefits: ['300kWh超の料金が約8%お得', '大家族向け', '4人以上世帯におすすめ'],
    minimumContractPeriod: 12,
    isAvailable: true,
    effectiveFrom: '2024-04-01'
  }
];

// =====================
// プラン変更申請サンプルデータ
// =====================
export const samplePlanChangeRequests: PlanChangeRequest[] = [];

// =====================
// ヘルパー関数
// =====================

// 顧客検索（ID または 電話番号下4桁）
export function findCustomer(identifier: string): Customer | undefined {
  return sampleCustomers.find(
    c => c.customerId === identifier || c.phoneLastFour === identifier
  );
}

// 顧客の請求履歴取得
export function getBillingsForCustomer(customerId: string, months: number = 6): Billing[] {
  return sampleBillings
    .filter(b => b.customerId === customerId)
    .sort((a, b) => {
      if (a.billingPeriod.year !== b.billingPeriod.year) {
        return b.billingPeriod.year - a.billingPeriod.year;
      }
      return b.billingPeriod.month - a.billingPeriod.month;
    })
    .slice(0, months);
}

// 今月使用量取得
export function getCurrentUsageForCustomer(customerId: string): CurrentMonthUsage | undefined {
  return sampleCurrentUsages.find(u => u.customerId === customerId);
}

// 利用可能プラン取得
export function getAvailablePlans(): ElectricityPlan[] {
  return samplePlans.filter(p => p.isAvailable);
}

// プラン取得（ID指定）
export function getPlanById(planId: string): ElectricityPlan | undefined {
  return samplePlans.find(p => p.id === planId);
}

// インメモリのプラン変更申請ストア
export const inMemoryPlanChangeRequests: PlanChangeRequest[] = [];

// プラン変更申請を追加
export function addPlanChangeRequest(request: PlanChangeRequest): void {
  inMemoryPlanChangeRequests.push(request);
}
