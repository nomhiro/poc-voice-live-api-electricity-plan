import { app, InvocationContext, arg } from '@azure/functions';
import { getCosmosClient } from '../lib/cosmosClient';
import { getBillingsForCustomer } from '../lib/sampleData';
import type { Billing, BillingHistoryResponse, ErrorResponse } from '../lib/types';

export async function getBillingHistory(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<string> {
  try {
    const args = (context.triggerMetadata?.mcptoolargs ?? {}) as {
      customerId?: string;
      months?: number;
    };

    const customerId = args?.customerId;
    const months = args?.months ?? 6;

    if (!customerId) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'お客様番号を入力してください。',
        errorCode: 'INVALID_INPUT'
      };
      return JSON.stringify(errorResponse);
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
        context.error('Cosmos DB error:', error);
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
      return JSON.stringify(errorResponse);
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

    return JSON.stringify(response);
  } catch (error) {
    context.error('Error in get_billing_history:', error);
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'システムエラーが発生しました。しばらくしてからお試しください。',
      errorCode: 'SYSTEM_ERROR'
    };
    return JSON.stringify(errorResponse);
  }
}

app.mcpTool('getBillingHistory', {
  toolName: 'get_billing_history',
  description: '指定した顧客の過去の請求履歴（使用量と請求金額）を取得します。',
  toolProperties: {
    customerId: arg.string().describe('顧客ID（必須。例: C-001）'),
    months: arg.number().describe('取得する月数（1〜24、デフォルト6）')
  },
  handler: getBillingHistory
});
