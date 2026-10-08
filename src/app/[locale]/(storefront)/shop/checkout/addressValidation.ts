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

export type AddressField = "name" | "email" | "phone" | "country" | "line1" | "city" | "zip";

/** Screen order — the order errors are listed in and the first one focused. */
export const ADDRESS_FIELD_ORDER: readonly AddressField[] = ["name", "email", "phone", "country", "line1", "city", "zip"];

export interface AddressValues {
  name: string;
  companyName: string;
  email: string;
  phone: string;
  country: string;
  line1: string;
  city: string;
  zip: string;
}

export interface AddressMessages {
  addrErrName: string;
  addrErrNameOrCompany: string;
  addrErrEmailInvalid: string;
  addrErrContact: string;
  addrErrPhoneInvalid: string;
  addrErrCountry: string;
  addrErrLine1: string;
  addrErrCity: string;
  addrErrZip: string;
}

/**
 * A field's problem: `message` is what is said under it. A field can be
 * marked wrong without a message of its own — an empty email AND phone is one
 * problem ("an email or a phone"), said once, under the email.
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

/**
 * Just as loose, and the same rule the API applies: an optional + or 00, then
 * 6 to 15 digits, with spaces, dots, dashes, slashes and brackets allowed
 * between them. The country code is added on the server from the shipping
 * country, so "06 12 34 56 78" is fine as typed.
 */
export function isPlausiblePhone(raw: string): boolean {
  const s = raw.trim().replace(/[\s.\-/()]/g, "");
  if (!/^(\+|00)?\d+$/.test(s)) return false;
  const digits = s.replace(/^\+|^00/, "");
  return digits.length >= 6 && digits.length <= 15;
}

export function validateAddress(v: AddressValues, opts: { companyAllowed: boolean }, m: AddressMessages): AddressErrors {
  const errors: AddressErrors = {};
  // One name field: at least two characters, one word is fine (not everyone
  // has two names). With the company option, a company name can stand in.
  const hasName = v.name.trim().length >= 2;
  if (!hasName && !(opts.companyAllowed && v.companyName.trim())) {
    errors.name = { message: opts.companyAllowed ? m.addrErrNameOrCompany : m.addrErrName };
  }

  // Email OR phone. Both empty is one problem, said once under the email and
  // marked on both; whichever is filled in must then be well-formed.
  const email = v.email.trim();
  const phone = v.phone.trim();
  if (!email && !phone) {
    errors.email = { message: m.addrErrContact };
    errors.phone = { message: null };
  } else {
    if (email && !EMAIL_PATTERN.test(email)) errors.email = { message: m.addrErrEmailInvalid };
    if (phone && !isPlausiblePhone(phone)) errors.phone = { message: m.addrErrPhoneInvalid };
  }

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
