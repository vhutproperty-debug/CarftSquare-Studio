export async function register() {
  const { validateResendConfigAtStartup } = await import('@/lib/env/resend');
  validateResendConfigAtStartup();
}
