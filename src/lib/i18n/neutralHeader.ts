import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

/**
 * The neutral header's reassurance copy (see components/layout/NeutralTrust):
 * three promises the shop actually keeps — Stripe-encrypted payment, the
 * 14-day returns of /info/returns, a person to ask — and the Help button.
 */
export interface NeutralHeaderCopy {
  secureTitle: string;
  secureSub: string;
  returnsTitle: string;
  returnsSub: string;
  helpTitle: string;
  helpSub: string;
  helpButton: string;
  /** Screen-reader name of the trust list. */
  trustLabel: string;
}

const dict: Record<Locale, NeutralHeaderCopy> = {
  en: { secureTitle: "Secure payment", secureSub: "Encrypted by Stripe", returnsTitle: "14-day returns", returnsSub: "Easy refunds", helpTitle: "Questions?", helpSub: "Chat with us", helpButton: "Help", trustLabel: "Why shop with us" },
  fr: { secureTitle: "Paiement sécurisé", secureSub: "Chiffré par Stripe", returnsTitle: "Retours sous 14 jours", returnsSub: "Remboursement simple", helpTitle: "Une question ?", helpSub: "Discutez avec nous", helpButton: "Aide", trustLabel: "Pourquoi acheter chez nous" },
  es: { secureTitle: "Pago seguro", secureSub: "Cifrado por Stripe", returnsTitle: "Devoluciones en 14 días", returnsSub: "Reembolso sencillo", helpTitle: "¿Alguna duda?", helpSub: "Habla con nosotros", helpButton: "Ayuda", trustLabel: "Por qué comprar con nosotros" },
  it: { secureTitle: "Pagamento sicuro", secureSub: "Crittografato da Stripe", returnsTitle: "Resi entro 14 giorni", returnsSub: "Rimborso semplice", helpTitle: "Domande?", helpSub: "Scrivici in chat", helpButton: "Aiuto", trustLabel: "Perché acquistare da noi" },
  de: { secureTitle: "Sichere Zahlung", secureSub: "Verschlüsselt über Stripe", returnsTitle: "14 Tage Rückgabe", returnsSub: "Einfache Erstattung", helpTitle: "Fragen?", helpSub: "Chatten Sie mit uns", helpButton: "Hilfe", trustLabel: "Warum bei uns kaufen" },
  nl: { secureTitle: "Veilig betalen", secureSub: "Versleuteld via Stripe", returnsTitle: "14 dagen retour", returnsSub: "Eenvoudig terugbetaald", helpTitle: "Vragen?", helpSub: "Chat met ons", helpButton: "Hulp", trustLabel: "Waarom bij ons kopen" },
  pl: { secureTitle: "Bezpieczna płatność", secureSub: "Szyfrowana przez Stripe", returnsTitle: "Zwrot w 14 dni", returnsSub: "Prosty zwrot pieniędzy", helpTitle: "Masz pytanie?", helpSub: "Napisz na czacie", helpButton: "Pomoc", trustLabel: "Dlaczego warto u nas kupić" },
  pt: { secureTitle: "Pagamento seguro", secureSub: "Encriptado pela Stripe", returnsTitle: "Devoluções em 14 dias", returnsSub: "Reembolso simples", helpTitle: "Alguma dúvida?", helpSub: "Fale connosco", helpButton: "Ajuda", trustLabel: "Porquê comprar connosco" },
};

export function getNeutralHeaderCopy(locale: string): NeutralHeaderCopy {
  return dict[(locale as Locale) in dict ? (locale as Locale) : DEFAULT_LOCALE];
}
