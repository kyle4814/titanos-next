export type OnboardingStep = { n: number; title: string; detail: string; intake?: string[] };
export function onboardingFor(slug: string): { slug: string; name: string; recurring: boolean; steps: OnboardingStep[] } | null;
