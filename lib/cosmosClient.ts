import { CosmosClient } from '@azure/cosmos'

let client: CosmosClient | null = null

export function getCosmosClient() {
  if (client) return client
  const endpoint = process.env.COSMOS_ENDPOINT
  const key = process.env.COSMOS_KEY
  if (!endpoint || !key) return null
  client = new CosmosClient({ endpoint, key })
  return client
}
