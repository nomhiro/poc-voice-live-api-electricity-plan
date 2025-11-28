@description('Cosmos DB account name')
param accountName string

@description('Location for the Cosmos DB account')
param location string = resourceGroup().location

@description('Tags to apply to all resources')
param tags object = {}

@description('Database name')
param databaseName string = 'electricity-support-db'

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

// Cosmos DB Account (Serverless)
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: accountName
  location: location
  tags: tags
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    capabilities: [
      {
        name: 'EnableServerless'
      }
    ]
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    enableFreeTier: false
    disableLocalAuth: false
  }
}

// Database
resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

// Customers Container
resource customersContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: customersContainerName
  properties: {
    resource: {
      id: customersContainerName
      partitionKey: {
        paths: [
          '/customerId'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/customerId/?'
          }
          {
            path: '/phoneLastFour/?'
          }
        ]
        excludedPaths: [
          {
            path: '/*'
          }
          {
            path: '/"_etag"/?'
          }
        ]
      }
    }
  }
}

// Billings Container
resource billingsContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: billingsContainerName
  properties: {
    resource: {
      id: billingsContainerName
      partitionKey: {
        paths: [
          '/customerId'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/customerId/?'
          }
          {
            path: '/billingPeriod/year/?'
          }
          {
            path: '/billingPeriod/month/?'
          }
        ]
        excludedPaths: [
          {
            path: '/*'
          }
          {
            path: '/"_etag"/?'
          }
        ]
      }
    }
  }
}

// Usages Container
resource usagesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: usagesContainerName
  properties: {
    resource: {
      id: usagesContainerName
      partitionKey: {
        paths: [
          '/customerId'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/customerId/?'
          }
          {
            path: '/year/?'
          }
          {
            path: '/month/?'
          }
        ]
        excludedPaths: [
          {
            path: '/*'
          }
          {
            path: '/"_etag"/?'
          }
        ]
      }
    }
  }
}

// Plans Container
resource plansContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: plansContainerName
  properties: {
    resource: {
      id: plansContainerName
      partitionKey: {
        paths: [
          '/planType'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/isAvailable/?'
          }
          {
            path: '/planType/?'
          }
        ]
        excludedPaths: [
          {
            path: '/*'
          }
          {
            path: '/"_etag"/?'
          }
        ]
      }
    }
  }
}

// Plan Change Requests Container
resource planChangesContainer 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: planChangesContainerName
  properties: {
    resource: {
      id: planChangesContainerName
      partitionKey: {
        paths: [
          '/customerId'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/customerId/?'
          }
          {
            path: '/status/?'
          }
        ]
        excludedPaths: [
          {
            path: '/*'
          }
          {
            path: '/"_etag"/?'
          }
        ]
      }
    }
  }
}

// Outputs
output endpoint string = cosmosAccount.properties.documentEndpoint
output accountName string = cosmosAccount.name
output databaseName string = database.name
output customersContainerName string = customersContainer.name
output billingsContainerName string = billingsContainer.name
output usagesContainerName string = usagesContainer.name
output plansContainerName string = plansContainer.name
output planChangesContainerName string = planChangesContainer.name
