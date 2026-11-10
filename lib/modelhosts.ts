// The ONE list of known model API hosts. Used by the guest-scan call meter
// (lib/guestscan/meter.ts) and by the static import-graph gate
// (scripts/test_guestscan_meter.mjs). A host matches when it equals an entry or
// is a subdomain of it. Add a host here and both the runtime meter and the
// static gate pick it up. This file is the denylist, so it is the only file on
// the guest path allowed to spell a model hostname.
export const MODEL_HOSTS = [
  "anthropic.com", "claude.ai",
  "openai.com", "openai.azure.com", "chatgpt.com",
  "generativelanguage.googleapis.com", "aiplatform.googleapis.com", "gemini.google.com",
  "mistral.ai", "cohere.com", "cohere.ai", "groq.com", "together.xyz", "together.ai",
  "x.ai", "perplexity.ai", "openrouter.ai", "deepseek.com", "fireworks.ai",
  "replicate.com", "ai21.com", "huggingface.co", "api-inference.huggingface.co",
  "inflection.ai", "writer.com", "voyageai.com", "jina.ai",
] as const;

// AWS Bedrock hosts carry a region in the middle: bedrock-runtime.<region>.amazonaws.com.
const PATTERNS: RegExp[] = [/^bedrock(-runtime|-agent-runtime)?(-fips)?\.[a-z0-9-]+\.amazonaws\.com$/i];

export function isModelHost(host: string): boolean {
  const h = String(host).toLowerCase().replace(/\.$/, "").replace(/:\d+$/, "");
  if (!h) return false;
  if (MODEL_HOSTS.some((m) => h === m || h.endsWith("." + m))) return true;
  return PATTERNS.some((p) => p.test(h));
}

// npm packages that would put a model client on a page. The static gate fails on any import of these.
export const MODEL_SDK_PACKAGES = [
  /^@anthropic-ai\//, /^anthropic$/, /^openai$/, /^@google\/generative-ai$/, /^@google\/genai$/, /^@google-cloud\/vertexai$/,
  /^cohere-ai$/, /^@mistralai\//, /^groq-sdk$/, /^together-ai$/, /^@ai-sdk\//, /^ai$/, /^langchain($|\/)/, /^@langchain\//,
  /^@aws-sdk\/client-bedrock/, /^replicate$/, /^ollama($|\/)/, /^@huggingface\//, /^llamaindex$/, /^@openrouter\//,
] as const;
export const isModelSdk = (spec: string): boolean => MODEL_SDK_PACKAGES.some((p) => p.test(spec));
