import { NextRequest, NextResponse } from 'next/server';
import { getCosmosClient } from '@/lib/cosmosClient';
import { getAvailablePlans, findCustomer, getBillingsForCustomer } from '@/lib/sampleData/electricity';
import type { ElectricityPlan, AvailablePlansResponse, ErrorResponse } from '@/lib/types/electricity';

interface RequestBody {
  customerId?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { customerId } = body;

    let plans: ElectricityPlan[] = [];
    let currentPlanId: string | undefined;
    let averageUsage = 0;

    // If customerId provided, get current plan and usage for recommendations
    if (customerId) {
      const customer = findCustomer(customerId);
      if (customer) {
        currentPlanId = customer.contract.planId;
        
        // Calculate average usage for recommendations
        const billings = getBillingsForCustomer(customerId, 6);
        if (billings.length > 0) {
          averageUsage = Math.round(
            billings.reduce((sum, b) => sum + b.usage.totalKwh, 0) / billings.length
          );
        }
      }
    }

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

        const { resources } = await container.items.query({
          query: 'SELECT * FROM c WHERE c.isAvailable = true'
        }).fetchAll();

        plans = resources as ElectricityPlan[];
      } catch (error) {
        console.error('Cosmos DB error:', error);
      }
    }

    // Fallback to sample data
    if (plans.length === 0) {
      plans = getAvailablePlans();
    }

    // Format plans for response
    const formattedPlans = plans.map(plan => {
      // Determine if plan is recommended based on usage
      let isRecommended = false;
      if (currentPlanId && plan.id !== currentPlanId) {
        // Recommend smart-eco for high night usage (we don't have that data, so skip)
        // Recommend family-value for high usage (>300kWh average)
        if (plan.id === 'plan-family-value' && averageUsage > 300) {
          isRecommended = true;
        }
        // Recommend green-plus for environmentally conscious (can't determine, skip)
      }

      return {
        planId: plan.id,
        planName: plan.planName,
        planType: plan.planType,
        description: plan.description,
        targetCustomer: plan.targetCustomer,
        basicCharges: plan.pricing.basicCharges,
        unitPrices: {
          tier1: `〜${plan.pricing.unitPrices.tier1.upToKwh}kWh: ${plan.pricing.unitPrices.tier1.pricePerKwh}円/kWh`,
          tier2: `${plan.pricing.unitPrices.tier1.upToKwh + 1}〜${plan.pricing.unitPrices.tier2.upToKwh}kWh: ${plan.pricing.unitPrices.tier2.pricePerKwh}円/kWh`,
          tier3: `${plan.pricing.unitPrices.tier2.upToKwh + 1}kWh〜: ${plan.pricing.unitPrices.tier3.pricePerKwh}円/kWh`
        },
        benefits: plan.benefits,
        minimumContractPeriod: plan.minimumContractPeriod,
        earlyTerminationFee: plan.earlyTerminationFee,
        isRecommended
      };
    });

    const response: AvailablePlansResponse = {
      success: true,
      currentPlanId,
      plans: formattedPlans
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in list_available_plans:', error);
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
    endpoint: 'list_available_plans',
    description: '契約可能な電力プランの一覧を取得します。',
    method: 'POST',
    parameters: {
      customerId: '顧客ID（省略可。指定時は現在の契約に基づいた推奨プランも含む）'
    }
  });
}
