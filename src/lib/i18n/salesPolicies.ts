import { LEGAL as L } from "@/lib/legal-entity";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

/**
 * Terms of sale, Returns & refunds, and the neutral contact page's heading,
 * in every storefront language.
 *
 * Each policy exists twice on the site: the main shop's pages (/terms,
 * /returns) and the neutral pages (/info/terms, /info/returns) linked from the
 * neutral footer, for products outside the embroidery range (see
 * lib/shop/neutralChrome.ts). Both read the same text; a section marked
 * `personalised` is about embroidered items and is left off the neutral pages.
 * The law and the promises are the same either way — only what does not
 * concern a neutral product is dropped.
 *
 * Company details come from lib/legal-entity.ts, like the other legal pages.
 */

export interface PolicySection {
  title: string;
  body: string;
  /** About personalised (embroidered) items: on the main shop's page only. */
  personalised?: boolean;
}

export interface PolicyDocument {
  title: string;
  intro: string;
  sections: PolicySection[];
}

export interface SalesPolicyCopy {
  updated: string;
  termsLink: string;
  returnsLink: string;
  terms: PolicyDocument;
  returns: PolicyDocument;
  /** The neutral contact page's heading — the main one asks "what can we embroider?". */
  neutralContact: { eyebrow: string; title: string; sub: string; back: string };
}

const en: SalesPolicyCopy = {
  updated: `Last updated: ${L.updatedAt}`,
  termsLink: "Terms of sale",
  returnsLink: "Returns & refunds",
  terms: {
    title: "Terms of Sale",
    intro: "These terms of sale apply to every order placed on this website. Placing an order means you accept them.",
    sections: [
      { title: "Seller", body: `Products are sold by ${L.companyName}, ${L.legalForm}, ${L.registeredAddress}, registration number ${L.registrationNumber}. Contact: ${L.supportEmail}.` },
      { title: "Products", body: "Each product page describes the item's main characteristics. Photos are as faithful as possible, but colours may look slightly different depending on your screen. Offers are valid while stock lasts." },
      { title: "Personalised items", personalised: true, body: "Embroidered items are made to order from the text, design and positions you choose. The on-screen preview shows the placement and is approximate in size and colour. You confirm that you hold the rights to any text, logo or image you send us; we may refuse a design that is unlawful or infringes someone else's rights, in which case we refund it." },
      { title: "Prices", body: "Prices are in euros, all taxes included. Delivery costs, if any, are shown before you pay. The price charged is the one displayed when you confirm your order." },
      { title: "Orders", body: "Your order is placed once your payment is accepted. We then send you a confirmation by email or SMS, depending on the contact details you gave. We may cancel an order in case of a payment problem or an obvious pricing error, and refund it in full." },
      { title: "Payment", body: "Payment is taken when you order, by bank card or another method offered at checkout (such as Klarna instalments, subject to Klarna's approval). Payments are processed securely by Stripe; we never see or store your card details." },
      { title: "Delivery", body: "We deliver to the countries offered at checkout. Delivery times are shown in business days on the product page and at checkout; they are estimates. You receive a tracking link as soon as your parcel ships. If your order has not arrived 30 days after the expected date, contact us and we will send it again or refund you." },
      { title: "Right of withdrawal", body: "You have 14 days from receiving your order to withdraw from your purchase, without giving a reason. How to do it, and how refunds work, is explained on our Returns & refunds page." },
      { title: "Exception for personalised items", personalised: true, body: "Under Article L221-28 of the French Consumer Code, the right of withdrawal does not apply to items made to your specifications or clearly personalised, such as embroidered items. Your legal guarantees below still apply if such an item is faulty." },
      { title: "Legal guarantees", body: "Every product is covered by the legal guarantee of conformity (Articles L217-3 et seq. of the French Consumer Code, 2 years from delivery) and the guarantee against hidden defects (Articles 1641 et seq. of the French Civil Code). If an item arrives damaged or faulty, contact us: we will replace or refund it at our expense." },
      { title: "Personal data", body: "Your personal data is used to process your order, as described in our Privacy Policy." },
      { title: "Disputes and applicable law", body: `Please contact us first — most issues are solved quickly. If we cannot find a solution together, you can refer the matter free of charge to the consumer mediator: ${L.consumerMediator}. These terms are governed by the laws of ${L.jurisdiction}.` },
    ],
  },
  returns: {
    title: "Returns & Refunds",
    intro: "Changed your mind, or received something that isn't right? Here is how returns and refunds work.",
    sections: [
      { title: "14 days to change your mind", body: "You can return an item within 14 days of receiving it, without giving a reason. It must be unused, complete and in its original packaging." },
      { title: "Personalised items", personalised: true, body: "Embroidered and other personalised items are made just for you, so they cannot be returned because you changed your mind. If one arrives damaged, faulty or different from what you ordered, we will remake it or refund you." },
      { title: "How to return an item", body: `Tell us within the 14 days through our contact page or at ${L.supportEmail}, with your order number. You can also use this statement: "I hereby give notice that I withdraw from my contract for the sale of the following goods: [item], ordered on [date] / received on [date], order number [number], [name], [address], [date]." Then send the item within 14 days of telling us to: ${L.returnAddress}.` },
      { title: "Return costs", body: "Sending the item back is at your expense, unless it is damaged, faulty or not what you ordered — then we cover it. We recommend a tracked service." },
      { title: "Refunds", body: "We refund you within 14 days of receiving your request, including the standard delivery cost, using the payment method you paid with. We may wait until the item is back with us, or you send proof that it was shipped, before refunding. Klarna payments are refunded through Klarna, which updates your instalments." },
      { title: "Damaged, faulty or wrong item", body: "Contact us within 30 days of delivery with your order number and a photo of the problem. We will send a replacement or refund you in full, return costs included. This comes on top of your legal guarantees, described in our Terms of sale." },
    ],
  },
  neutralContact: { eyebrow: "Get in touch", title: "Contact us", sub: "A question about a product or your order? Send us a message and we'll get back to you shortly.", back: "← Back to the product" },
};

const fr: SalesPolicyCopy = {
  updated: `Dernière mise à jour : ${L.updatedAt}`,
  termsLink: "Conditions générales de vente",
  returnsLink: "Retours et remboursements",
  terms: {
    title: "Conditions générales de vente",
    intro: "Les présentes conditions générales de vente s'appliquent à toute commande passée sur ce site. Passer commande vaut acceptation de ces conditions.",
    sections: [
      { title: "Vendeur", body: `Les produits sont vendus par ${L.companyName}, ${L.legalForm}, ${L.registeredAddress}, immatriculée sous le numéro ${L.registrationNumber}. Contact : ${L.supportEmail}.` },
      { title: "Produits", body: "Chaque fiche produit présente les caractéristiques essentielles de l'article. Les photos sont aussi fidèles que possible, mais les couleurs peuvent légèrement varier selon votre écran. Les offres sont valables dans la limite des stocks disponibles." },
      { title: "Articles personnalisés", personalised: true, body: "Les articles brodés sont fabriqués sur commande à partir du texte, du motif et des emplacements que vous choisissez. L'aperçu à l'écran montre le placement ; la taille et les couleurs y sont approximatives. Vous garantissez détenir les droits sur tout texte, logo ou image que vous nous transmettez ; nous pouvons refuser un motif illicite ou portant atteinte aux droits d'autrui, et le rembourser." },
      { title: "Prix", body: "Les prix sont indiqués en euros, toutes taxes comprises. Les éventuels frais de livraison sont affichés avant le paiement. Le prix facturé est celui affiché au moment de la validation de la commande." },
      { title: "Commande", body: "La commande est passée dès l'acceptation de votre paiement. Nous vous envoyons alors une confirmation par e-mail ou par SMS, selon les coordonnées indiquées. Nous pouvons annuler une commande en cas de problème de paiement ou d'erreur de prix manifeste, et la rembourser intégralement." },
      { title: "Paiement", body: "Le paiement est débité à la commande, par carte bancaire ou par un autre moyen proposé au paiement (comme le paiement en plusieurs fois Klarna, sous réserve d'acceptation par Klarna). Les paiements sont traités de façon sécurisée par Stripe ; nous ne voyons ni ne conservons vos données de carte." },
      { title: "Livraison", body: "Nous livrons dans les pays proposés au moment du paiement. Les délais sont indiqués en jours ouvrés sur la fiche produit et lors de la commande ; ils sont donnés à titre indicatif. Vous recevez un lien de suivi dès l'expédition de votre colis. Si votre commande n'est pas arrivée 30 jours après la date prévue, contactez-nous : nous la renvoyons ou vous remboursons." },
      { title: "Droit de rétractation", body: "Vous disposez de 14 jours à compter de la réception de votre commande pour vous rétracter, sans avoir à vous justifier. La marche à suivre et les modalités de remboursement sont détaillées sur notre page Retours et remboursements." },
      { title: "Exception pour les articles personnalisés", personalised: true, body: "Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation ne s'applique pas aux biens confectionnés selon vos spécifications ou nettement personnalisés, comme les articles brodés. Les garanties légales ci-dessous restent applicables si un tel article est défectueux." },
      { title: "Garanties légales", body: "Tous les produits bénéficient de la garantie légale de conformité (articles L217-3 et suivants du Code de la consommation, 2 ans à compter de la livraison) et de la garantie des vices cachés (articles 1641 et suivants du Code civil). Si un article arrive abîmé ou défectueux, contactez-nous : nous le remplaçons ou le remboursons à nos frais." },
      { title: "Données personnelles", body: "Vos données personnelles sont utilisées pour traiter votre commande, comme décrit dans notre Politique de confidentialité." },
      { title: "Litiges et droit applicable", body: `Contactez-nous d'abord : la plupart des problèmes se règlent rapidement. À défaut de solution amiable, vous pouvez saisir gratuitement le médiateur de la consommation : ${L.consumerMediator}. Les présentes conditions sont régies par le droit ${L.jurisdiction === "France" ? "français" : `de ${L.jurisdiction}`}.` },
    ],
  },
  returns: {
    title: "Retours et remboursements",
    intro: "Vous avez changé d'avis, ou reçu un article qui ne va pas ? Voici comment fonctionnent les retours et les remboursements.",
    sections: [
      { title: "14 jours pour changer d'avis", body: "Vous pouvez retourner un article dans les 14 jours suivant sa réception, sans avoir à vous justifier. Il doit être non utilisé, complet et dans son emballage d'origine." },
      { title: "Articles personnalisés", personalised: true, body: "Les articles brodés et autres articles personnalisés sont fabriqués spécialement pour vous : ils ne peuvent pas être retournés pour un simple changement d'avis. S'ils arrivent abîmés, défectueux ou différents de votre commande, nous les refaisons ou vous remboursons." },
      { title: "Comment retourner un article", body: `Prévenez-nous dans les 14 jours via notre page de contact ou à ${L.supportEmail}, en indiquant votre numéro de commande. Vous pouvez aussi utiliser cette déclaration : « Je vous notifie par la présente ma rétractation du contrat portant sur la vente du bien ci-dessous : [article], commandé le [date] / reçu le [date], commande n° [numéro], [nom], [adresse], [date]. » Renvoyez ensuite l'article dans les 14 jours suivant votre demande à : ${L.returnAddress}.` },
      { title: "Frais de retour", body: "Les frais de renvoi sont à votre charge, sauf si l'article est abîmé, défectueux ou ne correspond pas à votre commande : nous les prenons alors en charge. Nous vous conseillons un envoi suivi." },
      { title: "Remboursement", body: "Nous vous remboursons dans les 14 jours suivant votre demande, frais de livraison standard compris, par le moyen de paiement utilisé lors de la commande. Nous pouvons attendre la réception de l'article, ou une preuve de son expédition, avant de rembourser. Les paiements Klarna sont remboursés via Klarna, qui met à jour vos échéances." },
      { title: "Article abîmé, défectueux ou erroné", body: "Contactez-nous dans les 30 jours suivant la livraison avec votre numéro de commande et une photo du problème. Nous vous envoyons un remplacement ou vous remboursons intégralement, frais de retour compris. Cela s'ajoute à vos garanties légales, décrites dans nos Conditions générales de vente." },
    ],
  },
  neutralContact: { eyebrow: "Nous contacter", title: "Contactez-nous", sub: "Une question sur un produit ou sur votre commande ? Écrivez-nous, nous vous répondrons rapidement.", back: "← Retour au produit" },
};

const es: SalesPolicyCopy = {
  updated: `Última actualización: ${L.updatedAt}`,
  termsLink: "Condiciones de venta",
  returnsLink: "Devoluciones y reembolsos",
  terms: {
    title: "Condiciones generales de venta",
    intro: "Estas condiciones de venta se aplican a todos los pedidos realizados en este sitio web. Al hacer un pedido, las aceptas.",
    sections: [
      { title: "Vendedor", body: `Los productos los vende ${L.companyName}, ${L.legalForm}, ${L.registeredAddress}, número de registro ${L.registrationNumber}. Contacto: ${L.supportEmail}.` },
      { title: "Productos", body: "Cada página de producto describe las características principales del artículo. Las fotos son lo más fieles posible, pero los colores pueden variar ligeramente según tu pantalla. Las ofertas son válidas hasta agotar existencias." },
      { title: "Artículos personalizados", personalised: true, body: "Los artículos bordados se fabrican por encargo a partir del texto, el diseño y las posiciones que eliges. La vista previa en pantalla muestra la colocación; el tamaño y los colores son aproximados. Confirmas que tienes los derechos sobre cualquier texto, logotipo o imagen que nos envíes; podemos rechazar un diseño ilícito o que vulnere derechos de terceros y reembolsarlo." },
      { title: "Precios", body: "Los precios están en euros, con todos los impuestos incluidos. Los gastos de envío, si los hay, se muestran antes del pago. Se cobra el precio mostrado en el momento de confirmar el pedido." },
      { title: "Pedidos", body: "Tu pedido queda realizado en cuanto se acepta el pago. Te enviamos entonces una confirmación por correo electrónico o SMS, según los datos de contacto que nos diste. Podemos cancelar un pedido si hay un problema con el pago o un error de precio evidente, y reembolsarlo íntegramente." },
      { title: "Pago", body: "El pago se cobra al hacer el pedido, con tarjeta bancaria u otro método ofrecido en el pago (como los plazos de Klarna, sujetos a la aprobación de Klarna). Los pagos los procesa Stripe de forma segura; nunca vemos ni guardamos los datos de tu tarjeta." },
      { title: "Entrega", body: "Enviamos a los países ofrecidos en el pago. Los plazos se indican en días hábiles en la página del producto y en el pago; son estimaciones. Recibes un enlace de seguimiento en cuanto se envía tu paquete. Si tu pedido no ha llegado 30 días después de la fecha prevista, contáctanos y te lo enviaremos de nuevo o te lo reembolsaremos." },
      { title: "Derecho de desistimiento", body: "Tienes 14 días desde la recepción de tu pedido para desistir de la compra, sin necesidad de justificarlo. En nuestra página de Devoluciones y reembolsos te explicamos cómo hacerlo y cómo funcionan los reembolsos." },
      { title: "Excepción para artículos personalizados", personalised: true, body: "Según el artículo L221-28 del Código de Consumo francés, el derecho de desistimiento no se aplica a los artículos confeccionados según tus especificaciones o claramente personalizados, como los artículos bordados. Las garantías legales siguen aplicándose si uno de ellos es defectuoso." },
      { title: "Garantías legales", body: "Todos los productos están cubiertos por la garantía legal de conformidad (artículos L217-3 y siguientes del Código de Consumo francés, 2 años desde la entrega) y por la garantía de vicios ocultos (artículos 1641 y siguientes del Código Civil francés). Si un artículo llega dañado o defectuoso, contáctanos: lo sustituimos o te lo reembolsamos a nuestro cargo." },
      { title: "Datos personales", body: "Tus datos personales se utilizan para tramitar tu pedido, tal como se describe en nuestra Política de privacidad." },
      { title: "Litigios y ley aplicable", body: `Contáctanos primero: la mayoría de los problemas se resuelven rápidamente. Si no encontramos una solución juntos, puedes acudir gratuitamente al mediador de consumo: ${L.consumerMediator}. Estas condiciones se rigen por la legislación de ${L.jurisdiction === "France" ? "Francia" : L.jurisdiction}.` },
    ],
  },
  returns: {
    title: "Devoluciones y reembolsos",
    intro: "¿Has cambiado de opinión o has recibido algo que no está bien? Así funcionan las devoluciones y los reembolsos.",
    sections: [
      { title: "14 días para cambiar de opinión", body: "Puedes devolver un artículo en los 14 días siguientes a recibirlo, sin necesidad de justificarlo. Debe estar sin usar, completo y en su embalaje original." },
      { title: "Artículos personalizados", personalised: true, body: "Los artículos bordados y demás artículos personalizados se hacen solo para ti, así que no se pueden devolver por un cambio de opinión. Si llegan dañados, defectuosos o distintos de lo que pediste, los rehacemos o te los reembolsamos." },
      { title: "Cómo devolver un artículo", body: `Avísanos dentro de los 14 días a través de nuestra página de contacto o en ${L.supportEmail}, indicando tu número de pedido. También puedes usar esta declaración: «Por la presente le comunico que desisto de mi contrato de venta del siguiente bien: [artículo], pedido el [fecha] / recibido el [fecha], pedido n.º [número], [nombre], [dirección], [fecha].» Después envía el artículo en los 14 días siguientes a tu aviso a: ${L.returnAddress}.` },
      { title: "Gastos de devolución", body: "Los gastos de devolución corren de tu cuenta, salvo si el artículo está dañado, es defectuoso o no es lo que pediste: en ese caso los cubrimos nosotros. Te recomendamos un envío con seguimiento." },
      { title: "Reembolsos", body: "Te reembolsamos en los 14 días siguientes a tu solicitud, incluidos los gastos de envío estándar, con el mismo método de pago que usaste. Podemos esperar a recibir el artículo, o a que nos envíes el justificante de envío, antes de reembolsar. Los pagos con Klarna se reembolsan a través de Klarna, que actualiza tus plazos." },
      { title: "Artículo dañado, defectuoso o equivocado", body: "Contáctanos en los 30 días siguientes a la entrega con tu número de pedido y una foto del problema. Te enviamos un artículo de reemplazo o te reembolsamos íntegramente, gastos de devolución incluidos. Esto se suma a tus garantías legales, descritas en nuestras Condiciones de venta." },
    ],
  },
  neutralContact: { eyebrow: "Ponte en contacto", title: "Contáctanos", sub: "¿Tienes una duda sobre un producto o tu pedido? Envíanos un mensaje y te responderemos enseguida.", back: "← Volver al producto" },
};

const it: SalesPolicyCopy = {
  updated: `Ultimo aggiornamento: ${L.updatedAt}`,
  termsLink: "Condizioni di vendita",
  returnsLink: "Resi e rimborsi",
  terms: {
    title: "Condizioni generali di vendita",
    intro: "Queste condizioni di vendita si applicano a ogni ordine effettuato su questo sito. Effettuando un ordine, le accetti.",
    sections: [
      { title: "Venditore", body: `I prodotti sono venduti da ${L.companyName}, ${L.legalForm}, ${L.registeredAddress}, numero di registrazione ${L.registrationNumber}. Contatto: ${L.supportEmail}.` },
      { title: "Prodotti", body: "Ogni pagina prodotto descrive le caratteristiche principali dell'articolo. Le foto sono il più fedeli possibile, ma i colori possono variare leggermente a seconda dello schermo. Le offerte sono valide fino a esaurimento scorte." },
      { title: "Articoli personalizzati", personalised: true, body: "Gli articoli ricamati sono realizzati su ordinazione in base al testo, al disegno e alle posizioni che scegli. L'anteprima sullo schermo mostra il posizionamento; dimensioni e colori sono indicativi. Confermi di avere i diritti su qualsiasi testo, logo o immagine che ci invii; possiamo rifiutare un disegno illecito o che violi i diritti altrui, rimborsandolo." },
      { title: "Prezzi", body: "I prezzi sono in euro, tasse incluse. Le eventuali spese di spedizione sono mostrate prima del pagamento. Viene addebitato il prezzo visualizzato al momento della conferma dell'ordine." },
      { title: "Ordini", body: "Il tuo ordine è effettuato non appena il pagamento viene accettato. Ti inviamo quindi una conferma via e-mail o SMS, in base ai recapiti che ci hai fornito. Possiamo annullare un ordine in caso di problemi di pagamento o di un evidente errore di prezzo, rimborsandolo per intero." },
      { title: "Pagamento", body: "Il pagamento viene addebitato al momento dell'ordine, con carta di pagamento o con un altro metodo proposto al checkout (come le rate Klarna, soggette all'approvazione di Klarna). I pagamenti sono gestiti in modo sicuro da Stripe; non vediamo né conserviamo i dati della tua carta." },
      { title: "Consegna", body: "Spediamo nei paesi proposti al checkout. I tempi di consegna sono indicati in giorni lavorativi nella pagina prodotto e al checkout; sono stime. Ricevi un link di tracciamento appena il pacco viene spedito. Se l'ordine non è arrivato 30 giorni dopo la data prevista, contattaci: lo rispediamo o ti rimborsiamo." },
      { title: "Diritto di recesso", body: "Hai 14 giorni dalla ricezione dell'ordine per recedere dall'acquisto, senza dover fornire motivazioni. Come fare e come funzionano i rimborsi è spiegato nella nostra pagina Resi e rimborsi." },
      { title: "Eccezione per gli articoli personalizzati", personalised: true, body: "Ai sensi dell'articolo L221-28 del Codice del consumo francese, il diritto di recesso non si applica ai beni confezionati su misura o chiaramente personalizzati, come gli articoli ricamati. Le garanzie legali restano valide se uno di questi articoli è difettoso." },
      { title: "Garanzie legali", body: "Tutti i prodotti sono coperti dalla garanzia legale di conformità (articoli L217-3 e seguenti del Codice del consumo francese, 2 anni dalla consegna) e dalla garanzia per vizi occulti (articoli 1641 e seguenti del Codice civile francese). Se un articolo arriva danneggiato o difettoso, contattaci: lo sostituiamo o lo rimborsiamo a nostre spese." },
      { title: "Dati personali", body: "I tuoi dati personali sono utilizzati per gestire il tuo ordine, come descritto nella nostra Informativa sulla privacy." },
      { title: "Controversie e legge applicabile", body: `Contattaci prima di tutto: la maggior parte dei problemi si risolve rapidamente. Se non troviamo una soluzione insieme, puoi rivolgerti gratuitamente al mediatore dei consumatori: ${L.consumerMediator}. Queste condizioni sono regolate dalla legge ${L.jurisdiction === "France" ? "francese" : `di ${L.jurisdiction}`}.` },
    ],
  },
  returns: {
    title: "Resi e rimborsi",
    intro: "Hai cambiato idea o hai ricevuto qualcosa che non va? Ecco come funzionano resi e rimborsi.",
    sections: [
      { title: "14 giorni per cambiare idea", body: "Puoi restituire un articolo entro 14 giorni dalla ricezione, senza dover fornire motivazioni. Deve essere inutilizzato, completo e nella confezione originale." },
      { title: "Articoli personalizzati", personalised: true, body: "Gli articoli ricamati e gli altri articoli personalizzati sono realizzati apposta per te, quindi non possono essere restituiti per un ripensamento. Se arrivano danneggiati, difettosi o diversi da quanto ordinato, li rifacciamo o ti rimborsiamo." },
      { title: "Come restituire un articolo", body: `Avvisaci entro i 14 giorni tramite la nostra pagina di contatto o a ${L.supportEmail}, indicando il numero d'ordine. Puoi anche usare questa dichiarazione: «Con la presente notifico il recesso dal mio contratto di vendita del seguente bene: [articolo], ordinato il [data] / ricevuto il [data], ordine n. [numero], [nome], [indirizzo], [data].» Poi spedisci l'articolo entro 14 giorni dal tuo avviso a: ${L.returnAddress}.` },
      { title: "Spese di reso", body: "Le spese di restituzione sono a tuo carico, salvo che l'articolo sia danneggiato, difettoso o diverso da quanto ordinato: in quel caso le copriamo noi. Ti consigliamo una spedizione tracciata." },
      { title: "Rimborsi", body: "Ti rimborsiamo entro 14 giorni dalla tua richiesta, incluse le spese di spedizione standard, con lo stesso metodo di pagamento utilizzato. Possiamo attendere di ricevere l'articolo, o la prova della spedizione, prima di rimborsare. I pagamenti Klarna sono rimborsati tramite Klarna, che aggiorna le tue rate." },
      { title: "Articolo danneggiato, difettoso o sbagliato", body: "Contattaci entro 30 giorni dalla consegna con il numero d'ordine e una foto del problema. Ti inviamo un articolo sostitutivo o ti rimborsiamo per intero, spese di reso incluse. Questo si aggiunge alle tue garanzie legali, descritte nelle nostre Condizioni di vendita." },
    ],
  },
  neutralContact: { eyebrow: "Contattaci", title: "Contattaci", sub: "Una domanda su un prodotto o sul tuo ordine? Scrivici e ti risponderemo a breve.", back: "← Torna al prodotto" },
};

const de: SalesPolicyCopy = {
  updated: `Zuletzt aktualisiert: ${L.updatedAt}`,
  termsLink: "AGB",
  returnsLink: "Rückgabe & Erstattung",
  terms: {
    title: "Allgemeine Verkaufsbedingungen",
    intro: "Diese Verkaufsbedingungen gelten für jede Bestellung auf dieser Website. Mit Ihrer Bestellung erkennen Sie sie an.",
    sections: [
      { title: "Verkäufer", body: `Die Produkte werden verkauft von ${L.companyName}, ${L.legalForm}, ${L.registeredAddress}, Registernummer ${L.registrationNumber}. Kontakt: ${L.supportEmail}.` },
      { title: "Produkte", body: "Jede Produktseite beschreibt die wesentlichen Eigenschaften des Artikels. Die Fotos sind so originalgetreu wie möglich, Farben können je nach Bildschirm jedoch leicht abweichen. Angebote gelten, solange der Vorrat reicht." },
      { title: "Personalisierte Artikel", personalised: true, body: "Bestickte Artikel werden auf Bestellung nach dem von Ihnen gewählten Text, Motiv und Platzierungen gefertigt. Die Vorschau auf dem Bildschirm zeigt die Platzierung; Größe und Farben sind ungefähr. Sie bestätigen, dass Sie die Rechte an jedem Text, Logo oder Bild besitzen, das Sie uns senden; wir können ein rechtswidriges oder fremde Rechte verletzendes Motiv ablehnen und den Betrag erstatten." },
      { title: "Preise", body: "Die Preise verstehen sich in Euro inklusive aller Steuern. Eventuelle Versandkosten werden vor der Zahlung angezeigt. Berechnet wird der Preis, der bei der Bestätigung Ihrer Bestellung angezeigt wird." },
      { title: "Bestellung", body: "Ihre Bestellung ist aufgegeben, sobald Ihre Zahlung angenommen wurde. Wir senden Ihnen dann eine Bestätigung per E-Mail oder SMS, je nach den angegebenen Kontaktdaten. Bei einem Zahlungsproblem oder einem offensichtlichen Preisfehler können wir eine Bestellung stornieren und vollständig erstatten." },
      { title: "Zahlung", body: "Die Zahlung erfolgt bei der Bestellung per Bankkarte oder mit einer anderen an der Kasse angebotenen Methode (etwa Ratenzahlung mit Klarna, vorbehaltlich der Zustimmung von Klarna). Zahlungen werden sicher von Stripe abgewickelt; wir sehen und speichern Ihre Kartendaten nie." },
      { title: "Lieferung", body: "Wir liefern in die an der Kasse angebotenen Länder. Lieferzeiten werden auf der Produktseite und an der Kasse in Werktagen angegeben; es handelt sich um Schätzungen. Sie erhalten einen Sendungslink, sobald Ihr Paket versandt wird. Ist Ihre Bestellung 30 Tage nach dem voraussichtlichen Datum nicht angekommen, kontaktieren Sie uns: Wir senden sie erneut oder erstatten Ihnen den Betrag." },
      { title: "Widerrufsrecht", body: "Sie haben 14 Tage ab Erhalt Ihrer Bestellung, um Ihren Kauf ohne Angabe von Gründen zu widerrufen. Wie das geht und wie Erstattungen ablaufen, erklären wir auf unserer Seite Rückgabe & Erstattung." },
      { title: "Ausnahme für personalisierte Artikel", personalised: true, body: "Gemäß Artikel L221-28 des französischen Verbrauchergesetzbuchs gilt das Widerrufsrecht nicht für Waren, die nach Ihren Vorgaben angefertigt oder eindeutig personalisiert wurden, wie bestickte Artikel. Ihre gesetzlichen Gewährleistungsrechte gelten weiterhin, wenn ein solcher Artikel mangelhaft ist." },
      { title: "Gesetzliche Gewährleistung", body: "Alle Produkte unterliegen der gesetzlichen Konformitätsgarantie (Artikel L217-3 ff. des französischen Verbrauchergesetzbuchs, 2 Jahre ab Lieferung) und der Gewährleistung für verdeckte Mängel (Artikel 1641 ff. des französischen Zivilgesetzbuchs). Kommt ein Artikel beschädigt oder mangelhaft an, kontaktieren Sie uns: Wir ersetzen oder erstatten ihn auf unsere Kosten." },
      { title: "Personenbezogene Daten", body: "Ihre personenbezogenen Daten werden zur Abwicklung Ihrer Bestellung verwendet, wie in unserer Datenschutzerklärung beschrieben." },
      { title: "Streitigkeiten und anwendbares Recht", body: `Bitte kontaktieren Sie uns zuerst – die meisten Anliegen lassen sich schnell klären. Finden wir gemeinsam keine Lösung, können Sie sich kostenlos an die Verbraucherschlichtungsstelle wenden: ${L.consumerMediator}. Diese Bedingungen unterliegen dem Recht von ${L.jurisdiction === "France" ? "Frankreich" : L.jurisdiction}.` },
    ],
  },
  returns: {
    title: "Rückgabe & Erstattung",
    intro: "Sie haben es sich anders überlegt oder etwas erhalten, das nicht stimmt? So funktionieren Rückgaben und Erstattungen.",
    sections: [
      { title: "14 Tage, um es sich anders zu überlegen", body: "Sie können einen Artikel innerhalb von 14 Tagen nach Erhalt ohne Angabe von Gründen zurückgeben. Er muss unbenutzt, vollständig und in der Originalverpackung sein." },
      { title: "Personalisierte Artikel", personalised: true, body: "Bestickte und andere personalisierte Artikel werden eigens für Sie angefertigt und können daher nicht zurückgegeben werden, weil Sie es sich anders überlegt haben. Kommen sie beschädigt, mangelhaft oder abweichend von Ihrer Bestellung an, fertigen wir sie neu an oder erstatten den Betrag." },
      { title: "So geben Sie einen Artikel zurück", body: `Teilen Sie uns dies innerhalb der 14 Tage über unsere Kontaktseite oder an ${L.supportEmail} mit und geben Sie Ihre Bestellnummer an. Sie können auch diese Erklärung verwenden: „Hiermit widerrufe ich den von mir abgeschlossenen Vertrag über den Kauf der folgenden Waren: [Artikel], bestellt am [Datum] / erhalten am [Datum], Bestellnummer [Nummer], [Name], [Anschrift], [Datum].“ Senden Sie den Artikel dann innerhalb von 14 Tagen nach Ihrer Mitteilung an: ${L.returnAddress}.` },
      { title: "Rücksendekosten", body: "Die Kosten der Rücksendung tragen Sie, es sei denn, der Artikel ist beschädigt, mangelhaft oder entspricht nicht Ihrer Bestellung – dann übernehmen wir sie. Wir empfehlen einen Versand mit Sendungsverfolgung." },
      { title: "Erstattung", body: "Wir erstatten Ihnen den Betrag innerhalb von 14 Tagen nach Ihrem Widerruf, einschließlich der Standardversandkosten, über die von Ihnen genutzte Zahlungsmethode. Wir können die Erstattung verweigern, bis wir den Artikel zurückerhalten haben oder Sie den Versand nachweisen. Klarna-Zahlungen werden über Klarna erstattet, das Ihre Raten anpasst." },
      { title: "Beschädigter, mangelhafter oder falscher Artikel", body: "Kontaktieren Sie uns innerhalb von 30 Tagen nach der Lieferung mit Ihrer Bestellnummer und einem Foto des Problems. Wir senden Ihnen einen Ersatz oder erstatten den vollen Betrag, Rücksendekosten inklusive. Dies gilt zusätzlich zu Ihren gesetzlichen Gewährleistungsrechten, die in unseren AGB beschrieben sind." },
    ],
  },
  neutralContact: { eyebrow: "Kontaktieren Sie uns", title: "Kontakt", sub: "Eine Frage zu einem Produkt oder Ihrer Bestellung? Schreiben Sie uns, wir melden uns schnell zurück.", back: "← Zurück zum Produkt" },
};

const nl: SalesPolicyCopy = {
  updated: `Laatst bijgewerkt: ${L.updatedAt}`,
  termsLink: "Verkoopvoorwaarden",
  returnsLink: "Retouren en terugbetalingen",
  terms: {
    title: "Algemene verkoopvoorwaarden",
    intro: "Deze verkoopvoorwaarden gelden voor elke bestelling op deze website. Door te bestellen ga je ermee akkoord.",
    sections: [
      { title: "Verkoper", body: `De producten worden verkocht door ${L.companyName}, ${L.legalForm}, ${L.registeredAddress}, registratienummer ${L.registrationNumber}. Contact: ${L.supportEmail}.` },
      { title: "Producten", body: "Elke productpagina beschrijft de belangrijkste kenmerken van het artikel. De foto's zijn zo getrouw mogelijk, maar kleuren kunnen iets afwijken afhankelijk van je scherm. Aanbiedingen gelden zolang de voorraad strekt." },
      { title: "Gepersonaliseerde artikelen", personalised: true, body: "Geborduurde artikelen worden op bestelling gemaakt volgens de tekst, het ontwerp en de posities die je kiest. De voorbeeldweergave op het scherm toont de plaatsing; formaat en kleuren zijn bij benadering. Je bevestigt dat je de rechten hebt op elke tekst, elk logo of elke afbeelding die je ons stuurt; we kunnen een onrechtmatig ontwerp of een ontwerp dat de rechten van anderen schendt weigeren en terugbetalen." },
      { title: "Prijzen", body: "Prijzen zijn in euro's, inclusief alle belastingen. Eventuele verzendkosten zie je vóór het betalen. Je betaalt de prijs die getoond wordt op het moment dat je je bestelling bevestigt." },
      { title: "Bestellingen", body: "Je bestelling is geplaatst zodra je betaling is geaccepteerd. We sturen je dan een bevestiging per e-mail of sms, afhankelijk van de contactgegevens die je opgaf. Bij een betalingsprobleem of een duidelijke prijsfout kunnen we een bestelling annuleren en volledig terugbetalen." },
      { title: "Betaling", body: "De betaling wordt bij het bestellen afgeschreven, met een bankkaart of een andere methode die bij het afrekenen wordt aangeboden (zoals betalen in termijnen met Klarna, onder voorbehoud van goedkeuring door Klarna). Betalingen worden veilig verwerkt door Stripe; we zien of bewaren je kaartgegevens nooit." },
      { title: "Levering", body: "We leveren in de landen die bij het afrekenen worden aangeboden. Levertijden staan in werkdagen op de productpagina en bij het afrekenen; het zijn schattingen. Je krijgt een trackinglink zodra je pakket is verzonden. Is je bestelling 30 dagen na de verwachte datum niet aangekomen, neem dan contact met ons op: we sturen hem opnieuw of betalen je terug." },
      { title: "Herroepingsrecht", body: "Je hebt 14 dagen na ontvangst van je bestelling om je aankoop te herroepen, zonder opgave van reden. Hoe dat werkt en hoe terugbetalingen verlopen, lees je op onze pagina Retouren en terugbetalingen." },
      { title: "Uitzondering voor gepersonaliseerde artikelen", personalised: true, body: "Volgens artikel L221-28 van het Franse consumentenwetboek geldt het herroepingsrecht niet voor artikelen die volgens jouw specificaties zijn gemaakt of duidelijk gepersonaliseerd zijn, zoals geborduurde artikelen. Je wettelijke garanties blijven gelden als zo'n artikel defect is." },
      { title: "Wettelijke garanties", body: "Alle producten vallen onder de wettelijke conformiteitsgarantie (artikelen L217-3 e.v. van het Franse consumentenwetboek, 2 jaar vanaf levering) en de garantie tegen verborgen gebreken (artikelen 1641 e.v. van het Franse Burgerlijk Wetboek). Komt een artikel beschadigd of defect aan, neem dan contact met ons op: we vervangen het of betalen het op onze kosten terug." },
      { title: "Persoonsgegevens", body: "Je persoonsgegevens worden gebruikt om je bestelling te verwerken, zoals beschreven in ons Privacybeleid." },
      { title: "Geschillen en toepasselijk recht", body: `Neem eerst contact met ons op – de meeste problemen zijn snel opgelost. Komen we er samen niet uit, dan kun je je kosteloos wenden tot de consumentenbemiddelaar: ${L.consumerMediator}. Op deze voorwaarden is het recht van ${L.jurisdiction === "France" ? "Frankrijk" : L.jurisdiction} van toepassing.` },
    ],
  },
  returns: {
    title: "Retouren en terugbetalingen",
    intro: "Van gedachten veranderd, of iets ontvangen dat niet klopt? Zo werken retouren en terugbetalingen.",
    sections: [
      { title: "14 dagen bedenktijd", body: "Je kunt een artikel binnen 14 dagen na ontvangst retourneren, zonder opgave van reden. Het moet ongebruikt, compleet en in de originele verpakking zijn." },
      { title: "Gepersonaliseerde artikelen", personalised: true, body: "Geborduurde en andere gepersonaliseerde artikelen worden speciaal voor jou gemaakt en kunnen daarom niet worden geretourneerd omdat je van gedachten bent veranderd. Komen ze beschadigd, defect of anders dan besteld aan, dan maken we ze opnieuw of betalen we je terug." },
      { title: "Zo retourneer je een artikel", body: `Laat het ons binnen de 14 dagen weten via onze contactpagina of op ${L.supportEmail}, met je bestelnummer. Je kunt ook deze verklaring gebruiken: "Hierbij deel ik mee dat ik de overeenkomst betreffende de verkoop van de volgende goederen herroep: [artikel], besteld op [datum] / ontvangen op [datum], bestelnummer [nummer], [naam], [adres], [datum]." Stuur het artikel daarna binnen 14 dagen na je melding naar: ${L.returnAddress}.` },
      { title: "Retourkosten", body: "De kosten van het terugsturen zijn voor jouw rekening, tenzij het artikel beschadigd of defect is of niet is wat je bestelde – dan betalen wij ze. We raden een verzending met tracking aan." },
      { title: "Terugbetaling", body: "We betalen je binnen 14 dagen na je verzoek terug, inclusief de standaard verzendkosten, via de betaalmethode die je gebruikte. We kunnen wachten tot we het artikel terug hebben, of tot je een verzendbewijs stuurt, voordat we terugbetalen. Klarna-betalingen worden via Klarna terugbetaald, dat je termijnen aanpast." },
      { title: "Beschadigd, defect of verkeerd artikel", body: "Neem binnen 30 dagen na levering contact met ons op met je bestelnummer en een foto van het probleem. We sturen je een vervangend artikel of betalen je volledig terug, retourkosten inbegrepen. Dit komt bovenop je wettelijke garanties, beschreven in onze Verkoopvoorwaarden." },
    ],
  },
  neutralContact: { eyebrow: "Neem contact op", title: "Neem contact met ons op", sub: "Een vraag over een product of je bestelling? Stuur ons een bericht en we reageren snel.", back: "← Terug naar het product" },
};

const pl: SalesPolicyCopy = {
  updated: `Ostatnia aktualizacja: ${L.updatedAt}`,
  termsLink: "Regulamin sprzedaży",
  returnsLink: "Zwroty i refundacje",
  terms: {
    title: "Regulamin sprzedaży",
    intro: "Niniejszy regulamin dotyczy każdego zamówienia złożonego w tym sklepie. Składając zamówienie, akceptujesz go.",
    sections: [
      { title: "Sprzedawca", body: `Produkty sprzedaje ${L.companyName}, ${L.legalForm}, ${L.registeredAddress}, numer rejestrowy ${L.registrationNumber}. Kontakt: ${L.supportEmail}.` },
      { title: "Produkty", body: "Każda strona produktu opisuje główne cechy artykułu. Zdjęcia są możliwie wierne, ale kolory mogą się nieco różnić w zależności od ekranu. Oferty są ważne do wyczerpania zapasów." },
      { title: "Artykuły personalizowane", personalised: true, body: "Haftowane artykuły są wykonywane na zamówienie według wybranego przez Ciebie tekstu, wzoru i miejsc. Podgląd na ekranie pokazuje umiejscowienie; rozmiar i kolory są orientacyjne. Potwierdzasz, że masz prawa do każdego tekstu, logo lub obrazu, który nam przesyłasz; możemy odrzucić wzór niezgodny z prawem lub naruszający prawa innych osób i zwrócić za niego pieniądze." },
      { title: "Ceny", body: "Ceny podane są w euro i zawierają wszystkie podatki. Ewentualne koszty dostawy są widoczne przed zapłatą. Obowiązuje cena wyświetlona w chwili potwierdzenia zamówienia." },
      { title: "Zamówienia", body: "Zamówienie zostaje złożone z chwilą przyjęcia płatności. Wysyłamy wtedy potwierdzenie e-mailem lub SMS-em, zależnie od podanych danych kontaktowych. Możemy anulować zamówienie w razie problemu z płatnością lub oczywistego błędu w cenie i zwrócić całą kwotę." },
      { title: "Płatność", body: "Płatność pobierana jest przy składaniu zamówienia, kartą płatniczą lub inną metodą dostępną przy kasie (np. raty Klarna, pod warunkiem akceptacji przez Klarna). Płatności są bezpiecznie obsługiwane przez Stripe; nigdy nie widzimy ani nie przechowujemy danych Twojej karty." },
      { title: "Dostawa", body: "Wysyłamy do krajów dostępnych przy kasie. Czas dostawy podany jest w dniach roboczych na stronie produktu i przy kasie; są to wartości szacunkowe. Link do śledzenia przesyłki otrzymasz, gdy tylko paczka zostanie wysłana. Jeśli zamówienie nie dotrze w ciągu 30 dni od przewidywanej daty, skontaktuj się z nami: wyślemy je ponownie lub zwrócimy pieniądze." },
      { title: "Prawo odstąpienia od umowy", body: "Masz 14 dni od otrzymania zamówienia na odstąpienie od zakupu bez podawania przyczyny. Jak to zrobić i jak przebiegają zwroty pieniędzy, wyjaśniamy na stronie Zwroty i refundacje." },
      { title: "Wyjątek dla artykułów personalizowanych", personalised: true, body: "Zgodnie z art. L221-28 francuskiego kodeksu konsumenckiego prawo odstąpienia nie dotyczy rzeczy wykonanych według Twojej specyfikacji lub wyraźnie spersonalizowanych, takich jak artykuły haftowane. Gwarancje ustawowe nadal obowiązują, jeśli taki artykuł jest wadliwy." },
      { title: "Gwarancje ustawowe", body: "Wszystkie produkty objęte są ustawową gwarancją zgodności (art. L217-3 i nast. francuskiego kodeksu konsumenckiego, 2 lata od dostawy) oraz rękojmią za wady ukryte (art. 1641 i nast. francuskiego kodeksu cywilnego). Jeśli artykuł dotrze uszkodzony lub wadliwy, skontaktuj się z nami: wymienimy go lub zwrócimy pieniądze na nasz koszt." },
      { title: "Dane osobowe", body: "Twoje dane osobowe są wykorzystywane do realizacji zamówienia, zgodnie z naszą Polityką prywatności." },
      { title: "Spory i prawo właściwe", body: `Najpierw skontaktuj się z nami – większość spraw rozwiązujemy szybko. Jeśli nie znajdziemy wspólnie rozwiązania, możesz bezpłatnie zwrócić się do mediatora konsumenckiego: ${L.consumerMediator}. Regulamin podlega prawu ${L.jurisdiction === "France" ? "francuskiemu" : L.jurisdiction}.` },
    ],
  },
  returns: {
    title: "Zwroty i refundacje",
    intro: "Zmieniłeś zdanie albo otrzymałeś coś nie tak? Oto jak działają zwroty i refundacje.",
    sections: [
      { title: "14 dni na zmianę decyzji", body: "Możesz zwrócić artykuł w ciągu 14 dni od jego otrzymania, bez podawania przyczyny. Musi być nieużywany, kompletny i w oryginalnym opakowaniu." },
      { title: "Artykuły personalizowane", personalised: true, body: "Haftowane i inne personalizowane artykuły są wykonywane specjalnie dla Ciebie, dlatego nie można ich zwrócić z powodu zmiany decyzji. Jeśli dotrą uszkodzone, wadliwe lub inne niż zamówione, wykonamy je ponownie lub zwrócimy pieniądze." },
      { title: "Jak zwrócić artykuł", body: `Poinformuj nas w ciągu 14 dni przez stronę kontaktową lub pod adresem ${L.supportEmail}, podając numer zamówienia. Możesz też użyć tego oświadczenia: „Niniejszym informuję o odstąpieniu od umowy sprzedaży następującego towaru: [artykuł], zamówionego dnia [data] / otrzymanego dnia [data], zamówienie nr [numer], [imię i nazwisko], [adres], [data].” Następnie odeślij artykuł w ciągu 14 dni od zgłoszenia na adres: ${L.returnAddress}.` },
      { title: "Koszty zwrotu", body: "Koszt odesłania artykułu ponosisz Ty, chyba że jest on uszkodzony, wadliwy lub niezgodny z zamówieniem – wtedy pokrywamy go my. Zalecamy przesyłkę z numerem śledzenia." },
      { title: "Zwrot pieniędzy", body: "Zwracamy pieniądze w ciągu 14 dni od otrzymania Twojego zgłoszenia, wraz ze standardowym kosztem dostawy, tą samą metodą płatności, której użyłeś. Możemy wstrzymać zwrot do chwili otrzymania artykułu lub dowodu jego nadania. Płatności Klarna są zwracane przez Klarna, która aktualizuje Twoje raty." },
      { title: "Artykuł uszkodzony, wadliwy lub niewłaściwy", body: "Skontaktuj się z nami w ciągu 30 dni od dostawy, podając numer zamówienia i zdjęcie problemu. Wyślemy artykuł zastępczy lub zwrócimy całą kwotę, łącznie z kosztami zwrotu. To uzupełnia Twoje gwarancje ustawowe, opisane w Regulaminie sprzedaży." },
    ],
  },
  neutralContact: { eyebrow: "Skontaktuj się z nami", title: "Kontakt", sub: "Masz pytanie o produkt lub zamówienie? Napisz do nas, a szybko odpowiemy.", back: "← Wróć do produktu" },
};

const pt: SalesPolicyCopy = {
  updated: `Última atualização: ${L.updatedAt}`,
  termsLink: "Condições de venda",
  returnsLink: "Devoluções e reembolsos",
  terms: {
    title: "Condições gerais de venda",
    intro: "Estas condições de venda aplicam-se a todas as encomendas feitas neste site. Ao fazer uma encomenda, está a aceitá-las.",
    sections: [
      { title: "Vendedor", body: `Os produtos são vendidos por ${L.companyName}, ${L.legalForm}, ${L.registeredAddress}, número de registo ${L.registrationNumber}. Contacto: ${L.supportEmail}.` },
      { title: "Produtos", body: "Cada página de produto descreve as principais características do artigo. As fotografias são o mais fiéis possível, mas as cores podem variar ligeiramente consoante o seu ecrã. As ofertas são válidas até ao esgotamento do stock." },
      { title: "Artigos personalizados", personalised: true, body: "Os artigos bordados são feitos por encomenda a partir do texto, do desenho e das posições que escolher. A pré-visualização no ecrã mostra a colocação; o tamanho e as cores são aproximados. Confirma que detém os direitos sobre qualquer texto, logótipo ou imagem que nos envie; podemos recusar um desenho ilícito ou que viole direitos de terceiros e reembolsá-lo." },
      { title: "Preços", body: "Os preços são em euros, com todos os impostos incluídos. Os eventuais custos de envio são apresentados antes do pagamento. É cobrado o preço apresentado no momento da confirmação da encomenda." },
      { title: "Encomendas", body: "A sua encomenda fica feita assim que o pagamento é aceite. Enviamos-lhe então uma confirmação por e-mail ou SMS, conforme os contactos que indicou. Podemos cancelar uma encomenda em caso de problema com o pagamento ou de erro de preço evidente, reembolsando-a na totalidade." },
      { title: "Pagamento", body: "O pagamento é cobrado no momento da encomenda, por cartão bancário ou por outro método disponível no checkout (como as prestações Klarna, sujeitas à aprovação da Klarna). Os pagamentos são processados em segurança pela Stripe; nunca vemos nem guardamos os dados do seu cartão." },
      { title: "Entrega", body: "Enviamos para os países disponíveis no checkout. Os prazos de entrega são indicados em dias úteis na página do produto e no checkout; são estimativas. Recebe um link de seguimento assim que a sua encomenda é expedida. Se a encomenda não tiver chegado 30 dias após a data prevista, contacte-nos: voltamos a enviá-la ou reembolsamo-lo." },
      { title: "Direito de livre resolução", body: "Tem 14 dias a contar da receção da encomenda para desistir da compra, sem indicar motivo. Na nossa página Devoluções e reembolsos explicamos como fazê-lo e como funcionam os reembolsos." },
      { title: "Exceção para artigos personalizados", personalised: true, body: "Nos termos do artigo L221-28 do Código do Consumo francês, o direito de livre resolução não se aplica a bens feitos segundo as suas especificações ou claramente personalizados, como os artigos bordados. As garantias legais continuam a aplicar-se se um destes artigos tiver defeito." },
      { title: "Garantias legais", body: "Todos os produtos estão abrangidos pela garantia legal de conformidade (artigos L217-3 e seguintes do Código do Consumo francês, 2 anos a contar da entrega) e pela garantia contra vícios ocultos (artigos 1641 e seguintes do Código Civil francês). Se um artigo chegar danificado ou com defeito, contacte-nos: substituímo-lo ou reembolsamo-lo a nosso cargo." },
      { title: "Dados pessoais", body: "Os seus dados pessoais são utilizados para processar a sua encomenda, conforme descrito na nossa Política de privacidade." },
      { title: "Litígios e lei aplicável", body: `Contacte-nos primeiro — a maioria das questões resolve-se rapidamente. Se não encontrarmos uma solução em conjunto, pode recorrer gratuitamente ao mediador de consumo: ${L.consumerMediator}. Estas condições regem-se pela lei ${L.jurisdiction === "France" ? "francesa" : `de ${L.jurisdiction}`}.` },
    ],
  },
  returns: {
    title: "Devoluções e reembolsos",
    intro: "Mudou de ideias, ou recebeu algo que não está bem? Veja como funcionam as devoluções e os reembolsos.",
    sections: [
      { title: "14 dias para mudar de ideias", body: "Pode devolver um artigo no prazo de 14 dias após a receção, sem indicar motivo. Deve estar por usar, completo e na embalagem original." },
      { title: "Artigos personalizados", personalised: true, body: "Os artigos bordados e outros artigos personalizados são feitos só para si, por isso não podem ser devolvidos por mudança de ideias. Se chegarem danificados, com defeito ou diferentes do que encomendou, refazemo-los ou reembolsamo-lo." },
      { title: "Como devolver um artigo", body: `Avise-nos dentro dos 14 dias através da nossa página de contacto ou para ${L.supportEmail}, indicando o número da encomenda. Pode também usar esta declaração: «Pela presente comunico que exerço o meu direito de livre resolução do contrato de compra do seguinte bem: [artigo], encomendado em [data] / recebido em [data], encomenda n.º [número], [nome], [morada], [data].» Depois envie o artigo no prazo de 14 dias após o aviso para: ${L.returnAddress}.` },
      { title: "Custos de devolução", body: "Os custos de devolução ficam a seu cargo, exceto se o artigo estiver danificado, com defeito ou não corresponder à encomenda — nesse caso, suportamo-los nós. Recomendamos um envio com seguimento." },
      { title: "Reembolsos", body: "Reembolsamo-lo no prazo de 14 dias após o seu pedido, incluindo os custos de envio normais, pelo mesmo método de pagamento que utilizou. Podemos aguardar a receção do artigo, ou o comprovativo do envio, antes de reembolsar. Os pagamentos Klarna são reembolsados através da Klarna, que atualiza as suas prestações." },
      { title: "Artigo danificado, com defeito ou errado", body: "Contacte-nos no prazo de 30 dias após a entrega, com o número da encomenda e uma fotografia do problema. Enviamos-lhe um artigo de substituição ou reembolsamo-lo na totalidade, custos de devolução incluídos. Isto acresce às suas garantias legais, descritas nas nossas Condições de venda." },
    ],
  },
  neutralContact: { eyebrow: "Fale connosco", title: "Contacte-nos", sub: "Uma dúvida sobre um produto ou a sua encomenda? Envie-nos uma mensagem e responderemos em breve.", back: "← Voltar ao produto" },
};

const dict: Record<Locale, SalesPolicyCopy> = { en, fr, es, it, de, nl, pl, pt };

export function getSalesPolicies(locale: string): SalesPolicyCopy {
  return dict[(locale as Locale) in dict ? (locale as Locale) : DEFAULT_LOCALE];
}

/** A policy as the main shop shows it (everything) or the neutral pages do (no personalisation sections). */
export function policyFor(doc: PolicyDocument, neutral: boolean): PolicyDocument {
  return neutral ? { ...doc, sections: doc.sections.filter((s) => !s.personalised) } : doc;
}
