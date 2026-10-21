export const PAYMENT_READINESS = Object.freeze({
  checkoutEnabled: false,
  qrEnabled: false,
  confirmationEnabled: false,
  code: 'CHECKOUT_POLICY_PENDING',
  message:
    'CHECKOUT_POLICY_PENDING: Pricing, settlement and payment confirmation policy require business approval. Legacy invoices are not proof of verified payment.',
});
