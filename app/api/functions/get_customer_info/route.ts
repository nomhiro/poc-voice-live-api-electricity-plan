import { NextRequest, NextResponse } from 'next/server';
import { getCosmosClient } from '@/lib/cosmosClient';
import { findCustomer } from '@/lib/sampleData/electricity';
import type { Customer, CustomerInfoResponse, ErrorResponse } from '@/lib/types/electricity';

interface RequestBody {
  customerId?: string;
  verificationName?: string;
}

/**
 * ひらがなをカタカナに変換する
 */
function toKatakana(str: string): string {
  return str.replace(/[\u3041-\u3096]/g, (match) =>
    String.fromCharCode(match.charCodeAt(0) + 0x60)
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { customerId, verificationName } = body;

    if (!customerId) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'お客様番号または電話番号下4桁を入力してください。',
        errorCode: 'INVALID_INPUT'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    if (!verificationName) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'ご本人確認のため、ご契約者様のお名前をお教えください。',
        errorCode: 'INVALID_INPUT'
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    let customer: Customer | undefined;

    // Try Cosmos DB first
    const cosmos = getCosmosClient();
    if (cosmos) {
      try {
        const dbName = process.env.COSMOS_DB || 'electricity-support-db';
        const containerName = process.env.COSMOS_CUSTOMERS_CONTAINER || 'customers';
        const { database } = await cosmos.databases.createIfNotExists({ id: dbName });
        const { container } = await database.containers.createIfNotExists({
          id: containerName,
          partitionKey: { paths: ['/customerId'] }
        });

        // Search by customerId or phoneLastFour
        const { resources } = await container.items.query({
          query: 'SELECT * FROM c WHERE c.customerId = @id OR c.phoneLastFour = @id',
          parameters: [{ name: '@id', value: customerId }]
        }).fetchAll();

        if (resources.length > 0) {
          customer = resources[0] as Customer;
        }
      } catch (error) {
        console.error('Cosmos DB error:', error);
        // Fall through to sample data
      }
    }

    // Fallback to sample data
    if (!customer) {
      customer = findCustomer(customerId);
    }

    if (!customer) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'お客様情報が見つかりませんでした。お客様番号をご確認ください。',
        errorCode: 'CUSTOMER_NOT_FOUND'
      };
      return NextResponse.json(errorResponse, { status: 404 });
    }

    // Verify name - prioritize katakana matching for better voice recognition accuracy
    const normalizedCustomerName = customer.customerName.replace(/\s/g, '');
    const normalizedCustomerNameKana = customer.customerNameKana.replace(/\s/g, '');
    const normalizedVerificationName = verificationName.replace(/\s/g, '');
    const normalizedInputKana = toKatakana(normalizedVerificationName);

    const nameMatches =
      // カタカナでの照合（優先）- 音声認識の表記揺れに強い
      normalizedCustomerNameKana.includes(normalizedInputKana) ||
      normalizedInputKana.includes(normalizedCustomerNameKana) ||
      // 漢字でのフォールバック
      normalizedCustomerName.includes(normalizedVerificationName) ||
      normalizedVerificationName.includes(normalizedCustomerName.split(/[\s　]/)[0]);

    if (!nameMatches) {
      const errorResponse: ErrorResponse = {
        success: false,
        error: 'ご本人確認ができませんでした。ご契約者様のお名前をご確認ください。',
        errorCode: 'VERIFICATION_FAILED'
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    // Mask phone number
    const maskedPhone = customer.phone.replace(/^(\d{2,4})-(\d{4})-(\d{4})$/, '****-****-$3');

    // Format address
    const formattedAddress = `${customer.address.postalCode} ${customer.address.prefecture}${customer.address.city}${customer.address.street}`;

    // Format payment method
    let paymentMethodStr = '';
    switch (customer.paymentMethod.type) {
      case 'credit_card':
        paymentMethodStr = `クレジットカード（****${customer.paymentMethod.lastFourDigits}）`;
        break;
      case 'bank_transfer':
        paymentMethodStr = `口座振替（${customer.paymentMethod.bankName}）`;
        break;
      case 'convenience_store':
        paymentMethodStr = 'コンビニ払い';
        break;
    }

    const response: CustomerInfoResponse = {
      success: true,
      customer: {
        customerId: customer.customerId,
        customerName: customer.customerName,
        customerNameKana: customer.customerNameKana,
        phone: maskedPhone,
        email: customer.email,
        address: formattedAddress,
        contract: {
          contractId: customer.contract.contractId,
          planId: customer.contract.planId,
          planName: customer.contract.planName,
          contractedAmperage: customer.contract.contractedAmperage,
          contractStartDate: customer.contract.contractStartDate
        },
        meterType: customer.meterType,
        paymentMethod: paymentMethodStr
      }
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in get_customer_info:', error);
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
    endpoint: 'get_customer_info',
    description: '顧客IDまたは電話番号下4桁と契約者名で本人確認し、契約情報を取得します。',
    method: 'POST',
    parameters: {
      customerId: '顧客ID（例: C-001）または電話番号下4桁（例: 5678）',
      verificationName: '契約者名（漢字またはカナ）'
    }
  });
}
