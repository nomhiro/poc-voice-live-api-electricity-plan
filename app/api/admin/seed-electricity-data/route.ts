import { NextResponse } from 'next/server';
import { getCosmosClient } from '@/lib/cosmosClient';
import { sampleCustomers, sampleBillings, sampleCurrentUsages, samplePlans } from '@/lib/sampleData/electricity';

export async function POST() {
  const cosmos = getCosmosClient();
  
  if (!cosmos) {
    return NextResponse.json(
      { error: 'Cosmos DB not configured. Set COSMOS_ENDPOINT and COSMOS_KEY.' },
      { status: 500 }
    );
  }

  try {
    const dbName = process.env.COSMOS_DB || 'electricity-support-db';
    const customersContainerName = process.env.COSMOS_CUSTOMERS_CONTAINER || 'customers';
    const billingsContainerName = process.env.COSMOS_BILLINGS_CONTAINER || 'billings';
    const usagesContainerName = process.env.COSMOS_USAGES_CONTAINER || 'usages';
    const plansContainerName = process.env.COSMOS_PLANS_CONTAINER || 'plans';

    // Create database if not exists
    const { database } = await cosmos.databases.createIfNotExists({ id: dbName });

    // Create containers if not exist
    const { container: customersContainer } = await database.containers.createIfNotExists({
      id: customersContainerName,
      partitionKey: { paths: ['/customerId'] }
    });

    const { container: billingsContainer } = await database.containers.createIfNotExists({
      id: billingsContainerName,
      partitionKey: { paths: ['/customerId'] }
    });

    const { container: usagesContainer } = await database.containers.createIfNotExists({
      id: usagesContainerName,
      partitionKey: { paths: ['/customerId'] }
    });

    const { container: plansContainer } = await database.containers.createIfNotExists({
      id: plansContainerName,
      partitionKey: { paths: ['/planType'] }
    });

    const results = {
      customers: { created: 0, skipped: 0 },
      billings: { created: 0, skipped: 0 },
      usages: { created: 0, skipped: 0 },
      plans: { created: 0, skipped: 0 }
    };

    // Seed customers
    for (const customer of sampleCustomers) {
      try {
        await customersContainer.items.create(customer);
        results.customers.created++;
      } catch (e: unknown) {
        if ((e as { code?: number }).code === 409) {
          results.customers.skipped++;
        } else {
          throw e;
        }
      }
    }

    // Seed billings
    for (const billing of sampleBillings) {
      try {
        await billingsContainer.items.create(billing);
        results.billings.created++;
      } catch (e: unknown) {
        if ((e as { code?: number }).code === 409) {
          results.billings.skipped++;
        } else {
          throw e;
        }
      }
    }

    // Seed usages
    for (const usage of sampleCurrentUsages) {
      try {
        await usagesContainer.items.create(usage);
        results.usages.created++;
      } catch (e: unknown) {
        if ((e as { code?: number }).code === 409) {
          results.usages.skipped++;
        } else {
          throw e;
        }
      }
    }

    // Seed plans
    for (const plan of samplePlans) {
      try {
        await plansContainer.items.create(plan);
        results.plans.created++;
      } catch (e: unknown) {
        if ((e as { code?: number }).code === 409) {
          results.plans.skipped++;
        } else {
          throw e;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Seed data inserted successfully',
      results,
      details: {
        customers: results.customers.created + results.customers.skipped,
        billings: results.billings.created + results.billings.skipped,
        usages: results.usages.created + results.usages.skipped,
        plans: results.plans.created + results.plans.skipped
      }
    });
  } catch (error) {
    console.error('Error seeding data:', error);
    return NextResponse.json(
      { error: 'Failed to seed data', details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const cosmos = getCosmosClient();
  
  if (!cosmos) {
    return NextResponse.json(
      { error: 'Cosmos DB not configured. Set COSMOS_ENDPOINT and COSMOS_KEY.' },
      { status: 500 }
    );
  }

  try {
    const dbName = process.env.COSMOS_DB || 'electricity-support-db';
    const customersContainerName = process.env.COSMOS_CUSTOMERS_CONTAINER || 'customers';
    const billingsContainerName = process.env.COSMOS_BILLINGS_CONTAINER || 'billings';
    const usagesContainerName = process.env.COSMOS_USAGES_CONTAINER || 'usages';
    const plansContainerName = process.env.COSMOS_PLANS_CONTAINER || 'plans';
    const planChangesContainerName = process.env.COSMOS_PLAN_CHANGES_CONTAINER || 'plan_change_requests';

    const { database } = await cosmos.databases.createIfNotExists({ id: dbName });

    const results = {
      customers: 0,
      billings: 0,
      usages: 0,
      plans: 0,
      planChanges: 0
    };

    // Delete all items from each container
    const containers = [
      { name: customersContainerName, key: 'customers', partitionKey: 'customerId' },
      { name: billingsContainerName, key: 'billings', partitionKey: 'customerId' },
      { name: usagesContainerName, key: 'usages', partitionKey: 'customerId' },
      { name: plansContainerName, key: 'plans', partitionKey: 'planType' },
      { name: planChangesContainerName, key: 'planChanges', partitionKey: 'customerId' }
    ];

    for (const containerInfo of containers) {
      try {
        const { container } = await database.containers.createIfNotExists({
          id: containerInfo.name,
          partitionKey: { paths: [`/${containerInfo.partitionKey}`] }
        });

        const { resources: items } = await container.items.query('SELECT * FROM c').fetchAll();
        
        for (const item of items) {
          const partitionKeyValue = item[containerInfo.partitionKey];
          await container.item(item.id, partitionKeyValue).delete();
          results[containerInfo.key as keyof typeof results]++;
        }
      } catch {
        // Container might not exist, skip
      }
    }

    return NextResponse.json({
      success: true,
      message: 'All data deleted successfully',
      results
    });
  } catch (error) {
    console.error('Error deleting data:', error);
    return NextResponse.json(
      { error: 'Failed to delete data', details: String(error) },
      { status: 500 }
    );
  }
}
