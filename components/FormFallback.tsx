// Suspense fallback for client forms that read useSearchParams (static export: the form only
// mounts after hydration). Reserves the form's height so the content below does not jump
// (measured CLS 0.39 to 0.54 on /order/ai and /order/leads before this).
export default function FormFallback({ minHeight = 1200 }: { minHeight?: number }) {
  return <div aria-hidden="true" data-form-fallback style={{ minHeight }} />;
}
