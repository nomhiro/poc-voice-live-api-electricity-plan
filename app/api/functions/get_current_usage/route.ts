import { NextRequest, NextResponse } from 'next/server';
import { getCosmosClient } from '@/lib/cosmosClient';
import { getCurrentUsageForCustomer, findCustomer, getBillingsForCustomer } from '@/lib/sampleData/electricity';
import type { CurrentMonthUsage, CurrentUsageResponse, ErrorResponse } from '@/lib/types/electricity';

interface RequestBody {
  customerId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { customerId } = body;

    if (!customerId) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'お客様番号を入力してください。',
        errorCode: 'INVALID_INPUT'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Check if customer has smart meter
    let hasSmart = false;
    const cosmos = getCosmosClient();
    
    if (cosmos) {
      try {
        const dbName = process.env.COSMOS_DB || 'electricity-support-db';
        const customerContainer = process.env.COSMOS_CUSTOMERS_CONTAINER || 'customers';
        const { database } = await cosmos.databases.createIfNotExists({ id: dbName });
        const { container } = await database.containers.createIfNotExists({
          id: customerContainer,
          partitionKey: { paths: ['/customerId'] }
        });

        const { resources } = await container.items.query({
          query: 'SELECT c.meterType FROM c WHERE c.customerId = @id',
          parameters: [{ name: '@id', value: customerId }]
        }).fetchAll();

        if (resources.length > 0) {
          hasSmart = resources[0].meterType === 'smart';
        }
      } catch (error) {
        console.error('Cosmos DB error checking meter type:', error);
      }
    }

    // Fallback to sample data
    if (!hasSmart) {
      const customer = findCustomer(customerId);
      if (customer) {
        hasSmart = customer.meterType === 'smart';
      } else {
        const errorResponse: ErrorResponse = {
          success: false,
          error: 'お客様情報が見つかりませんでした。',
          errorCode: 'CUSTOMER_NOT_FOUND'
        };
        return NextResponse.json(errorResponse, { status: 404 });
      }
    }

    if (!hasSmart) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'スマートメーターが設置されていないため、リアルタイムの使用量は確認できません。次回の検針日以降に請求書でご確認ください。',
        errorCode: 'SMART_METER_NOT_AVAILABLE'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    let currentUsage: CurrentMonthUsage | undefined;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Try Cosmos DB first
    if (cosmos) {
      try {
        const dbName = process.env.COSMOS_DB || 'electricity-support-db';
        const containerName = process.env.COSMOS_USAGES_CONTAINER || 'usages';
        const { database } = await cosmos.databases.createIfNotExists({ id: dbName });
        const { container } = await database.containers.createIfNotExists({
          id: containerName,
          partitionKey: { paths: ['/customerId'] }
        });

        const { resources } = await container.items.query({
          query: 'SELECT * FROM c WHERE c.customerId = @id AND c.year = @year AND c.month = @month',
          parameters: [
            { name: '@id', value: customerId },
            { name: '@year', value: currentYear },
            { name: '@month', value: currentMonth }
          ]
        }).fetchAll();

        if (resources.length > 0) {
          currentUsage = resources[0] as CurrentMonthUsage;
        }
      } catch (error) {
        console.error('Cosmos DB error:', error);
      }
    }

    // Fallback to sample data
    if (!currentUsage) {
      currentUsage = getCurrentUsageForCustomer(customerId);
    }

    if (!currentUsage) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: '今月の使用量データがまだありません。',
        errorCode: 'CUSTOMER_NOT_FOUND'
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Get last month's usage for comparison
    let lastMonthUsage = 0;
    const billings = getBillingsForCustomer(customerId, 1);
    if (billings.length > 0) {
      lastMonthUsage = billings[0].usage.totalKwh;
    }

    // Calculate comparison with last month (pro-rata)
    const estimatedLastMonthSamePeriod = Math.floor(lastMonthUsage * currentUsage.daysElapsed / 30);
    let comparison = '';
    if (estimatedLastMonthSamePeriod > 0) {
      const diff = ((currentUsage.totalKwhToDate - estimatedLastMonthSamePeriod) / estimatedLastMonthSamePeriod) * 100;
      comparison = diff >= 0 ? `+${Math.round(diff)}%` : `${Math.round(diff)}%`;
    } else {
      comparison = '比較データなし';
    }

    // Calculate estimated bill breakdown
    const estimatedKwh = currentUsage.estimatedMonthlyKwh;
    const tier1 = Math.min(estimatedKwh, 120);
    const tier2 = Math.min(Math.max(estimatedKwh - 120, 0), 180);
    const tier3 = Math.max(estimatedKwh - 300, 0);

    const basicCharge = 1180; // Assuming 40A
    const usageCharge = Math.round(tier1 * 19.88 + tier2 * 26.46 + tier3 * 30.57);
    const fuelAdjustment = Math.round(estimatedKwh * -0.8);
    const renewableEnergy = Math.round(estimatedKwh * 1.4);

    const response: CurrentUsageResponse = {
      success: true,
      customerId,
      currentMonth: `${currentYear}年${currentMonth}月`,
      usage: {
        totalKwhToDate: currentUsage.totalKwhToDate,
        daysElapsed: currentUsage.daysElapsed,
        estimatedMonthlyKwh: currentUsage.estimatedMonthlyKwh,
        comparisonWithLastMonth: comparison
      },
      estimatedBill: {
        estimatedAmount: currentUsage.estimatedMonthlyCharge,
        breakdown: {
          basicCharge,
          usageCharge,
          fuelAdjustment,
          renewableEnergy
        }
      },
      lastUpdated: currentUsage.lastUpdated
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in get_current_usage:', error);
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'システムエラーが発生しました。しばらくしてからお試しください。',
      errorCode: 'SYSTEM_ERROR'
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    endpoint: 'get_current_usage',
    description: '今月の電力使用量をリアルタイムで取得します（スマートメーター対応のお客様のみ）。',
    method: 'POST',
    parameters: {
      customerId: '顧客ID（必須）'
    }
  });
}
