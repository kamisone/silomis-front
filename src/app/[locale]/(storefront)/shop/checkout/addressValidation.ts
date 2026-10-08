/**
 * The address step's validation, in one place and in the order the fields
 * appear on screen.
 *
 * It replaces the browser's own "Please fill out this field" bubbles, which
 * had two problems: they only ever showed one field at a time, in the
 * browser's language rather than the shop's, and they did not cover the name
 * fields (those were checked in code afterwards) — so a customer who had left
 * the name and the postcode empty was sent to the postcode first, fixed it,
 * and only then learned about the name.
 */

export type AddressField = "firstName" | "lastName" | "email" | "country" | "line1" | "city" | "zip";

/** Screen order — the order errors are listed in and the first one focused. */
export const ADDRESS_FIELD_ORDER: readonly AddressField[] = ["firstName", "lastName", "email", "country", "line1", "city", "zip"];

export interface AddressValues {
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  country: string;
  line1: string;
  city: string;
  zip: string;
}

export interface AddressMessages {
  addrErrFirstName: string;
  addrErrLastName: string;
  addrErrNameOrCompany: string;
  addrErrEmail: string;
  addrErrEmailInvalid: string;
  addrErrCountry: string;
  addrErrLine1: string;
  addrErrCity: string;
  addrErrZip: string;
}

/**
 * A field's problem: `message` is what is said under it. A field can be
 * marked wrong without a message of its own — when the company option is
 * offered, an empty first AND last name is one problem ("a name or a
 * company"), said once, on the first of them.
 */
export interface FieldError {
  message: string | null;
}

export type AddressErrors = Partial<Record<AddressField, FieldError>>;

/**
 * Deliberately loose: something@something.tld, no spaces. The real check is
 * the confirmation email arriving; a strict pattern only ever rejects real
 * addresses (plus-addressing, new TLDs, internationalised domains).
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateAddress(v: AddressValues, opts: { companyAllowed: boolean }, m: AddressMessages): AddressErrors {
  const errors: AddressErrors = {};
  const first = v.firstName.trim();
  const last = v.lastName.trim();

  if (opts.companyAllowed && !v.companyName.trim()) {
    // No company: the name is required in full. One message for the pair,
    // under whichever of the two is empty first.
    if (!first || !last) {
      let said = false;
      for (const [key, value] of [["firstName", first], ["lastName", last]] as const) {
        if (value) continue;
        errors[key] = { message: said ? null : m.addrErrNameOrCompany };
        said = true;
      }
    }
  } else if (!opts.companyAllowed) {
    if (!first) errors.firstName = { message: m.addrErrFirstName };
    if (!last) errors.lastName = { message: m.addrErrLastName };
  }

  const email = v.email.trim();
  if (!email) errors.email = { message: m.addrErrEmail };
  else if (!EMAIL_PATTERN.test(email)) errors.email = { message: m.addrErrEmailInvalid };

  if (!v.country) errors.country = { message: m.addrErrCountry };
  if (!v.line1.trim()) errors.line1 = { message: m.addrErrLine1 };
  if (!v.city.trim()) errors.city = { message: m.addrErrCity };
  if (!v.zip.trim()) errors.zip = { message: m.addrErrZip };

  return errors;
}

/** The errors in screen order — the summary's list and the field to focus. */
export function orderedErrors(errors: AddressErrors): { field: AddressField; message: string | null }[] {
  return ADDRESS_FIELD_ORDER.filter((f) => errors[f]).map((f) => ({ field: f, message: errors[f]!.message }));
}
