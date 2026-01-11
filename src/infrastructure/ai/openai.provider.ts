import { openai } from "./openai.client";
import { selectModel, ModelTier } from "./modelSelector";

interface GenerateTextParams {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export class OpenAIProvider {
  constructor(private tier: ModelTier = "fast") {}

  async generateText({
    prompt,
    temperature = 0.4,
    maxTokens = 200
  }: GenerateTextParams): Promise<string> {
    const model = selectModel(this.tier);

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: "You are MIA.ai." },
        { role: "user", content: prompt }
      ],
      temperature,
      max_tokens: maxTokens
    });

    return response.choices[0].message.content ?? "";
  }
}
