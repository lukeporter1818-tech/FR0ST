import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function askAI(systemPrompt: string, userMessage: string, maxTokens = 1024): Promise<string> {
  const response = await anthropic.messages.create(
    {
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    },
    { timeout: 20_000 },  // Anthropic SDK default is 10 min — cap at 20 s for Vercel
  )
  const block = response.content[0]
  if (block.type === 'text') return block.text
  return ''
}

export { anthropic }
