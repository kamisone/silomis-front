/**
 * Opens the support chat bubble from anywhere on the storefront ("Chat with
 * us" at checkout, say) without threading state through the layout: the
 * widget, mounted once in the storefront layout, listens for this event.
 */
export const OPEN_SUPPORT_CHAT_EVENT = "silomis:open-support-chat";

export function openSupportChat(): void {
  window.dispatchEvent(new Event(OPEN_SUPPORT_CHAT_EVENT));
}
