import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";

// Create Bedrock provider
export const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION || "us-east-1",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// Nova models — use cross-region inference profiles (required for on-demand throughput)
export const novaPro = bedrock("us.amazon.nova-pro-v1:0");
export const novaSonic = bedrock("us.amazon.nova-sonic-v1:0");
export const novaLite = bedrock("us.amazon.nova-lite-v1:0");

// Nova Multimodal Embeddings - use correct model ID
export const novaEmbeddings = bedrock.textEmbeddingModel("amazon.titan-embed-text-v2:0");
