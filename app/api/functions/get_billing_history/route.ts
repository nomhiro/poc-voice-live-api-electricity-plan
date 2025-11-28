import { NextRequest, NextResponse } from 'next/server';
import { getCosmosClient } from '@/lib/cosmosClient';
import { getBillingsForCustomer } from '@/lib/sampleData/electricity';
import type { Billing, BillingHistoryResponse, ErrorResponse } from '@/lib/types/electricity';

interface RequestBody {
  customerId?: string;
  months?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { customerId, months = 6 } = body;

    if (!customerId) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'お客様番号を入力してください。',
        errorCode: 'INVALID_INPUT'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    const monthsToFetch = Math.min(Math.max(months, 1), 24);
    let billings: Billing[] = [];

    // Try Cosmos DB first
    const cosmos = getCosmosClient();
    if (cosmos) {
      try {
        const dbName = process.env.COSMOS_DB || 'electricity-support-db';
        const containerName = process.env.COSMOS_BILLINGS_CONTAINER || 'billings';
        const { database } = await cosmos.databases.createIfNotExists({ id: dbName });
        const { container } = await database.containers.createIfNotExists({
          id: containerName,
          partitionKey: { paths: ['/customerId'] }
        });

        const { resources } = await container.items.query({
          query: `SELECT * FROM c WHERE c.customerId = @customerId 
                  ORDER BY c.billingPeriod.year DESC, c.billingPeriod.month DESC 
                  OFFSET 0 LIMIT @limit`,
          parameters: [
            { name: '@customerId', value: customerId },
            { name: '@limit', value: monthsToFetch }
          ]
        }).fetchAll();

        billings = resources as Billing[];
      } catch (error) {
        console.error('Cosmos DB error:', error);
        // Fall through to sample data
      }
    }

    // Fallback to sample data
    if (billings.length === 0) {
      billings = getBillingsForCustomer(customerId, monthsToFetch);
    }

    if (billings.length === 0) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: '請求履歴が見つかりませんでした。',
        errorCode: 'CUSTOMER_NOT_FOUND'
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Format billings for response
    const formattedBillings = billings.map(b => ({
      billingMonth: `${b.billingPeriod.year}年${b.billingPeriod.month}月`,
      usageKwh: b.usage.totalKwh,
      basicCharge: b.charges.basicCharge,
      usageCharge: b.charges.tier1Charge + b.charges.tier2Charge + b.charges.tier3Charge,
      fuelAdjustment: b.charges.fuelAdjustment,
      renewableEnergy: b.charges.renewableEnergy,
      totalAmount: b.charges.totalAmount,
      paymentStatus: b.paymentStatus,
      paymentDueDate: b.paymentDueDate
    }));

    // Calculate summary
    const totalUsage = billings.reduce((sum, b) => sum + b.usage.totalKwh, 0);
    const totalAmount = billings.reduce((sum, b) => sum + b.charges.totalAmount, 0);

    const response: BillingHistoryResponse = {
      success: true,
      customerId,
      billings: formattedBillings,
      summary: {
        totalMonths: billings.length,
        averageUsageKwh: Math.round(totalUsage / billings.length),
        averageAmount: Math.round(totalAmount / billings.length)
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in get_billing_history:', error);
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
    endpoint: 'get_billing_history',
    description: '過去の請求履歴を取得します。',
    method: 'POST',
    parameters: {
      customerId: '顧客ID（必須）',
      months: '取得する月数（1〜24、デフォルト6）'
    }
  });
}
