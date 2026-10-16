/**
 * A carrier's brand mark beside its method name, so a customer who knows the
 * relay-point network recognises it at a glance. Matched on the method code
 * the backend seeds (MONDIAL_RELAY_METHOD_CODE), with the carrier name as a
 * fallback for a method the admin created by hand.
 */
export function carrierLogo(m: { code: string | null; carrier: string | null }): string | null {
  if (m.code === "mondial_relay" || /mondial\s*relay/i.test(m.carrier ?? "")) return "/assets/carriers/mondial-relay.svg";
  return null;
}
