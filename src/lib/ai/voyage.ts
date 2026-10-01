const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_RERANK_URL = 'https://api.voyageai.com/v1/rerank'
const MODEL = 'voyage-3.5'

interface VoyageResponse {
  data: { embedding: number[]; index: number }[]
  usage: { total_tokens: number }
}

interface VoyageRerankResponse {
  data: { index: number; relevance_score: number }[]
  usage: { total_tokens: number }
}

export interface RerankHit {
  index: number
  relevanceScore: number
}

export async function embedDocuments(texts: string[]): Promise<{ embeddings: number[][]; tokens: number }> {
  return callVoyage(texts, 'document')
}

export async function embedQuery(text: string): Promise<{ embedding: number[]; tokens: number }> {
  const { embeddings, tokens } = await callVoyage([text], 'query')
  return { embedding: embeddings[0], tokens }
}

export async function rerankDocuments(
  query: string,
  documents: string[],
  model: string,
  signal?: AbortSignal,
): Promise<RerankHit[]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error('VOYAGE_API_KEY is not configured')

  const res = await fetch(VOYAGE_RERANK_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, documents, model }),
    signal,
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Voyage rerank ${res.status}: ${body.slice(0, 500)}`)
  }

  const json = (await res.json()) as VoyageRerankResponse
  return json.data.map((d) => ({ index: d.index, relevanceScore: d.relevance_score }))
}

async function callVoyage(input: string[], inputType: 'document' | 'query') {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error('VOYAGE_API_KEY is not configured')

  const res = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input, model: MODEL, input_type: inputType }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Voyage API ${res.status}: ${body.slice(0, 500)}`)
  }

  const json = (await res.json()) as VoyageResponse
  const sorted = [...json.data].sort((a, b) => a.index - b.index)
  return {
    embeddings: sorted.map((d) => d.embedding),
    tokens: json.usage.total_tokens,
  }
}
