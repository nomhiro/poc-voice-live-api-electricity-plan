import { app, InvocationContext, arg } from '@azure/functions';
import { getCosmosClient } from '../lib/cosmosClient';
import { findCustomer, getBillingsForCustomer, getPlanById } from '../lib/sampleData';
import type { ElectricityPlan, Billing, SimulationResponse, ErrorResponse } from '../lib/types';

// Calculate charge for a given usage and plan
function calculateCharge(usageKwh: number, plan: ElectricityPlan, amperage: number): number {
  // Find basic charge for amperage
  const basicChargeEntry = plan.pricing.basicCharges.find(bc => bc.amperage === amperage);
  const basicCharge = basicChargeEntry ? basicChargeEntry.monthlyCharge : plan.pricing.basicCharges[0].monthlyCharge;

  // Calculate tiered usage charges
  const tier1Kwh = Math.min(usageKwh, plan.pricing.unitPrices.tier1.upToKwh);
  const tier2Kwh = Math.min(Math.max(usageKwh - plan.pricing.unitPrices.tier1.upToKwh, 0),
    plan.pricing.unitPrices.tier2.upToKwh - plan.pricing.unitPrices.tier1.upToKwh);
  const tier3Kwh = Math.max(usageKwh - (plan.pricing.unitPrices.tier2.upToKwh || 300), 0);

  const tier1Charge = tier1Kwh * plan.pricing.unitPrices.tier1.pricePerKwh;
  const tier2Charge = tier2Kwh * plan.pricing.unitPrices.tier2.pricePerKwh;
  const tier3Charge = tier3Kwh * plan.pricing.unitPrices.tier3.pricePerKwh;

  // Fuel adjustment and renewable energy surcharge (simplified)
  const fuelAdjustment = usageKwh * -0.8;
  const renewableEnergy = usageKwh * 1.4;

  const subtotal = basicCharge + tier1Charge + tier2Charge + tier3Charge + fuelAdjustment + renewableEnergy;
  const tax = subtotal * 0.1;

  return Math.round(subtotal + tax);
}

export async function simulatePlanChange(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<string> {
  try {
    const args = (context.triggerMetadata?.mcptoolargs ?? {}) as {
      customerId?: string;
      newPlanId?: string;
    };

    const customerId = args?.customerId;
    const newPlanId = args?.newPlanId;

    if (!customerId) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'お客様番号を入力してください。',
        errorCode: 'INVALID_INPUT'
      };
      return JSON.stringify(errorResponse);
    }

    if (!newPlanId) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: '変更先のプランIDを指定してください。',
        errorCode: 'INVALID_INPUT'
      };
      return JSON.stringify(errorResponse);
    }

    // Get customer info
    const customer = findCustomer(customerId);
    if (!customer) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'お客様情報が見つかりませんでした。',
        errorCode: 'CUSTOMER_NOT_FOUND'
      };
      return JSON.stringify(errorResponse);
    }

    // Get current and new plan
    let currentPlan: ElectricityPlan | undefined;
    let newPlan: ElectricityPlan | undefined;

    // Try Cosmos DB first
    const cosmos = getCosmosClient();
    if (cosmos) {
      try {
        const dbName = process.env.COSMOS_DB || 'electricity-support-db';
        const containerName = process.env.COSMOS_PLANS_CONTAINER || 'plans';
        const { database } = await cosmos.databases.createIfNotExists({ id: dbName });
        const { container } = await database.containers.createIfNotExists({
          id: containerName,
          partitionKey: { paths: ['/planType'] }
        });

        const { resources: currentPlanResources } = await container.items.query({
          query: 'SELECT * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: customer.contract.planId }]
        }).fetchAll();

        const { resources: newPlanResources } = await container.items.query({
          query: 'SELECT * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: newPlanId }]
        }).fetchAll();

        if (currentPlanResources.length > 0) {
          currentPlan = currentPlanResources[0] as ElectricityPlan;
        }
        if (newPlanResources.length > 0) {
          newPlan = newPlanResources[0] as ElectricityPlan;
        }
      } catch (error) {
        context.error('Cosmos DB error:', error);
      }
    }

    // Fallback to sample data
    if (!currentPlan) {
      currentPlan = getPlanById(customer.contract.planId);
    }
    if (!newPlan) {
      newPlan = getPlanById(newPlanId);
    }

    if (!currentPlan) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: '現在のプラン情報が見つかりませんでした。',
        errorCode: 'PLAN_NOT_FOUND'
      };
      return JSON.stringify(errorResponse);
    }

    if (!newPlan) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: '指定されたプランが見つかりませんでした。',
        errorCode: 'PLAN_NOT_FOUND'
      };
      return JSON.stringify(errorResponse);
    }

    if (!newPlan.isAvailable) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: '指定されたプランは現在お申込みいただけません。',
        errorCode: 'PLAN_NOT_FOUND'
      };
      return JSON.stringify(errorResponse);
    }

    // Get billing history for simulation
    let billings: Billing[] = [];
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
                  OFFSET 0 LIMIT 12`,
          parameters: [{ name: '@customerId', value: customerId }]
        }).fetchAll();

        billings = resources as Billing[];
      } catch (error) {
        context.error('Cosmos DB error:', error);
      }
    }

    if (billings.length === 0) {
      billings = getBillingsForCustomer(customerId, 12);
    }

    if (billings.length === 0) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: '過去の使用量データがないためシミュレーションができません。',
        errorCode: 'CUSTOMER_NOT_FOUND'
      };
      return JSON.stringify(errorResponse);
    }

    const amperage = customer.contract.contractedAmperage;

    // Calculate monthly comparison
    const monthlyComparison = billings.map(billing => {
      const usageKwh = billing.usage.totalKwh;
      const currentPlanAmount = calculateCharge(usageKwh, currentPlan!, amperage);
      const newPlanAmount = calculateCharge(usageKwh, newPlan!, amperage);

      return {
        month: `${billing.billingPeriod.year}年${billing.billingPeriod.month}月`,
        usageKwh,
        currentPlanAmount,
        newPlanAmount,
        difference: newPlanAmount - currentPlanAmount
      };
    });

    // Calculate summary
    const totalCurrentPlan = monthlyComparison.reduce((sum, m) => sum + m.currentPlanAmount, 0);
    const totalNewPlan = monthlyComparison.reduce((sum, m) => sum + m.newPlanAmount, 0);
    const totalDifference = totalNewPlan - totalCurrentPlan;
    const averageMonthlyDifference = Math.round(totalDifference / monthlyComparison.length);
    const estimatedAnnualSaving = averageMonthlyDifference * -12; // Negative if saving
    const savingsPercent = Math.round((totalDifference / totalCurrentPlan) * -100);

    // Build notes
    const notes: string[] = [];
    if (newPlan.minimumContractPeriod) {
      notes.push(`このプランには${newPlan.minimumContractPeriod}ヶ月の最低契約期間があります。`);
    }
    if (newPlan.earlyTerminationFee) {
      notes.push(`期間内解約の場合、${newPlan.earlyTerminationFee.toLocaleString()}円の解約手数料がかかります。`);
    }
    if (totalDifference > 0) {
      notes.push('シミュレーション結果では料金が上がる見込みです。ご検討ください。');
    }

    const response: SimulationResponse = {
      success: true,
      customerId,
      currentPlan: {
        planId: currentPlan.id,
        planName: currentPlan.planName
      },
      newPlan: {
        planId: newPlan.id,
        planName: newPlan.planName
      },
      simulation: {
        monthlyComparison,
        summary: {
          averageMonthlyDifference,
          estimatedAnnualSaving,
          savingsPercent
        }
      },
      notes
    };

    return JSON.stringify(response);
  } catch (error) {
    context.error('Error in simulate_plan_change:', error);
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'システムエラーが発生しました。しばらくしてからお試しください。',
      errorCode: 'SYSTEM_ERROR'
    };
    return JSON.stringify(errorResponse);
  }
}

app.mcpTool('simulatePlanChange', {
  toolName: 'simulate_plan_change',
  description: 'プラン変更した場合の月額料金をシミュレーションし、現在のプランとの差額を計算します。',
  toolProperties: {
    customerId: arg.string().describe('顧客ID（必須。例: C-001）'),
    newPlanId: arg.string().describe('変更先のプランID（必須。例: plan-family-value）')
  },
  handler: simulatePlanChange
});
