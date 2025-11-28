targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment (e.g., dev, staging, prod)')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('Cosmos DB database name')
param cosmosDbName string = 'electricity-support-db'

@description('Customers container name')
param customersContainerName string = 'customers'

@description('Billings container name')
param billingsContainerName string = 'billings'

@description('Usages container name')
param usagesContainerName string = 'usages'

@description('Plans container name')
param plansContainerName string = 'plans'

@description('Plan change requests container name')
param planChangesContainerName string = 'plan_change_requests'

// Tags for all resources
var tags = {
  'azd-env-name': environmentName
  project: 'poc-voice-live-api-electricity-plan'
}

// Resource naming
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var cosmosAccountName = 'cosmos-${resourceToken}'

// Resource Group
resource rg 'Microsoft.Resources/resourceGroups@2022-09-01' = {
  name: 'rg-${environmentName}'
  location: location
  tags: tags
}

// Cosmos DB Module
module cosmosDb './modules/cosmos-db.bicep' = {
  name: 'cosmos-db-deployment'
  scope: rg
  params: {
    accountName: cosmosAccountName
    location: location
    tags: tags
    databaseName: cosmosDbName
    customersContainerName: customersContainerName
    billingsContainerName: billingsContainerName
    usagesContainerName: usagesContainerName
    plansContainerName: plansContainerName
    planChangesContainerName: planChangesContainerName
  }
}

// Outputs for azd
output AZURE_LOCATION string = location
output AZURE_TENANT_ID string = tenant().tenantId
output COSMOS_ENDPOINT string = cosmosDb.outputs.endpoint
output COSMOS_DB string = cosmosDbName
output COSMOS_CUSTOMERS_CONTAINER string = customersContainerName
output COSMOS_BILLINGS_CONTAINER string = billingsContainerName
output COSMOS_USAGES_CONTAINER string = usagesContainerName
output COSMOS_PLANS_CONTAINER string = plansContainerName
output COSMOS_PLAN_CHANGES_CONTAINER string = planChangesContainerName
