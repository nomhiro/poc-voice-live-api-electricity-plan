import { app, InvocationContext, arg } from '@azure/functions';
import { getCosmosClient } from '../lib/cosmosClient';
import { findCustomer, getPlanById, addPlanChangeRequest } from '../lib/sampleData';
import { sendPlanChangeNotification } from '../lib/emailClient';
import type { PlanChangeRequest, ElectricityPlan, PlanChangeSubmitResponse, ErrorResponse } from '../lib/types';

export async function submitPlanChangeRequest(
  _toolArguments: unknown,
  context: InvocationContext
): Promise<string> {
  try {
    const args = (context.triggerMetadata?.mcptoolargs ?? {}) as {
      customerId?: string;
      newPlanId?: string;
      customerConfirmation?: boolean;
    };

    const customerId = args?.customerId;
    const newPlanId = args?.newPlanId;
    const customerConfirmation = args?.customerConfirmation;

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

    if (!customerConfirmation) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'プラン変更にはお客様の同意確認が必要です。変更内容をご確認の上、同意いただけますか？',
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

    // Get new plan
    let newPlan: ElectricityPlan | undefined;
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
          query: 'SELECT * FROM c WHERE c.id = @id',
          parameters: [{ name: '@id', value: newPlanId }]
        }).fetchAll();

        if (resources.length > 0) {
          newPlan = resources[0] as ElectricityPlan;
        }
      } catch (error) {
        context.error('Cosmos DB error:', error);
      }
    }

    if (!newPlan) {
      newPlan = getPlanById(newPlanId);
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

    // Check if already on this plan
    if (customer.contract.planId === newPlanId) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'すでにこのプランをご契約中です。',
        errorCode: 'INVALID_INPUT'
      };
      return JSON.stringify(errorResponse);
    }

    // Calculate effective date (next month's billing cycle)
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const effectiveDate = nextMonth.toISOString().split('T')[0];

    // Create plan change request
    const requestId = `PCR-${customerId}-${Date.now().toString(36)}`;
    const planChangeRequest: PlanChangeRequest = {
      id: requestId,
      customerId,
      currentPlan: {
        planId: customer.contract.planId,
        planName: customer.contract.planName,
        amperage: customer.contract.contractedAmperage
      },
      requestedPlan: {
        planId: newPlan.id,
        planName: newPlan.planName,
        amperage: customer.contract.contractedAmperage // Keep same amperage
      },
      status: 'pending',
      requestedEffectiveDate: effectiveDate,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    // Save to Cosmos DB or in-memory
    if (cosmos) {
      try {
        const dbName = process.env.COSMOS_DB || 'electricity-support-db';
        const containerName = process.env.COSMOS_PLAN_CHANGES_CONTAINER || 'plan_change_requests';
        const { database } = await cosmos.databases.createIfNotExists({ id: dbName });
        const { container } = await database.containers.createIfNotExists({
          id: containerName,
          partitionKey: { paths: ['/customerId'] }
        });

        await container.items.create(planChangeRequest);
      } catch (error) {
        context.error('Cosmos DB error:', error);
        // Fallback to in-memory
        addPlanChangeRequest(planChangeRequest);
      }
    } else {
      addPlanChangeRequest(planChangeRequest);
    }

    // Format effective date for display
    const effectiveDateObj = new Date(effectiveDate);
    const effectiveDateStr = `${effectiveDateObj.getFullYear()}年${effectiveDateObj.getMonth() + 1}月`;

    // Send notification email (best effort - don't fail if email fails)
    await sendPlanChangeNotification({
      to: customer.email,
      customerName: customer.customerName,
      requestId,
      currentPlanName: customer.contract.planName,
      newPlanName: newPlan.planName,
      effectiveDate: effectiveDateStr
    });

    const response: PlanChangeSubmitResponse = {
      success: true,
      requestId,
      customerId,
      changeDetails: {
        currentPlanName: customer.contract.planName,
        newPlanName: newPlan.planName,
        effectiveDate: effectiveDateStr,
        submittedAt: now.toISOString()
      },
      message: `プラン変更申請を受け付けました。${effectiveDateStr}の検針日から${newPlan.planName}が適用されます。`,
      nextSteps: [
        '確認のメールをお送りしますので、ご確認ください。',
        '変更内容に誤りがある場合は、お電話にてお問い合わせください。',
        newPlan.minimumContractPeriod
          ? `なお、${newPlan.planName}には${newPlan.minimumContractPeriod}ヶ月の最低契約期間がございます。`
          : ''
      ].filter(Boolean)
    };

    return JSON.stringify(response);
  } catch (error) {
    context.error('Error in submit_plan_change_request:', error);
    const errorResponse: ErrorResponse = {
      success: false,
      error: 'システムエラーが発生しました。しばらくしてからお試しください。',
      errorCode: 'SYSTEM_ERROR'
    };
    return JSON.stringify(errorResponse);
  }
}

app.mcpTool('submitPlanChangeRequest', {
  toolName: 'submit_plan_change_request',
  description: '料金プランの変更申請を行います。申請前にお客様の同意確認が必要です。',
  toolProperties: {
    customerId: arg.string().describe('顧客ID（必須。例: C-001）'),
    newPlanId: arg.string().describe('変更先のプランID（必須。例: plan-family-value）'),
    customerConfirmation: arg.boolean().describe('お客様の同意確認（必須: true）')
  },
  handler: submitPlanChangeRequest
});
