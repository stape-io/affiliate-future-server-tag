# Affiliate Future Tag for Google Tag Manager Server-Side

The **Affiliate Future Tag** for Google Tag Manager Server-Side allows you to send conversion data directly to Affiliate Future's servers. This tag operates in two modes: capturing page view data to set an attribution cookie, and sending conversion events.

This tag supports two primary actions:

- **Page View**: Captures the Affiliate Future Click ID from the URL and saves it as a cookie for later use.
- **Conversion**: Sends a server-to-server request (postback) with conversion data to Affiliate Future.

## How to use the Affiliate Future Tag

1.  Add the **Affiliate Future Tag** to your server container in GTM.
2.  Select the **Event Type** you want to perform (`Page View` or `Conversion`).
3.  For `Page View` events, the tag will automatically look for the `affc` URL parameter and set the `affc_cid` cookie. This action should fire on all landing pages.
4.  For `Conversion` events, fill in your `Merchant ID` and the required conversion parameters.
5.  Add triggers to fire the tag based on the selected event type (e.g., all page views for "Page View", purchase events for "Conversion").

## Actions

### Page View

When the event type is set to `Page View`, the tag's role is to capture the unique Click ID from the landing page URL. It looks for the `affc` parameter (or a custom-defined parameter) and stores its value in a first-party cookie named `affc_cid`. This cookie is then used by the `Conversion` event to correctly attribute the sale.

### Conversion

When the event type is set to `Conversion`, the tag sends the final transaction data to Affiliate Future. It automatically retrieves the Click ID from the `affc_cid` server-side cookie set during the Page View, or the `Affc` cookie set by the web JS script.

## Parameters (Conversion Event)

### Required Parameters

- **Merchant ID**: The Merchant ID provided by Affiliate Future.
- **Order ID**: A unique ID for the transaction. The tag will try to use `orderId`, `order_id`, or `transaction_id` from the event data if not specified.
- **Order Value**: The total net value of the transaction (excluding taxes, delivery, etc.). The tag will try to use `value` from the event data if not specified.
- **affc Value (Click ID)**: The unique Click ID for attribution. If left empty, the tag will automatically retrieve this value from the server-side `affc_cid` cookie, and will fallback to the web JS script `Affc` cookie if needed.

### Optional Parameters

- **Currency Code**: The currency code per the ISO 4217 standard (EUR, USD etc.).
- **Voucher**: The voucher code used in the transaction. The tag will try to use `coupon` from the event data if not specified.
- **Payout Codes**: A comma-separated string to apply different commission rates to specific parts of an order (e.g., `CODE1,10.50,CODE2,25.00`).
- **Products (Product Level Tracking)**: An array of product objects for detailed reporting. The tag can automatically use `items` from the event data. Each product object should include properties like `id`, `sku`, `name`, `category`, `price`, and `quantity`.

## Consent Settings

This section controls how the tag handles user consent for setting and reading the `affc_cid` cookie and reading the `Affc` cookie.

- **Consent Detecion**: You can choose how the tag determines consent:
  - **Send data always**: Tag tag does not check for consent. It will always sets and read cookies, and send data to Affiliate Future.
  - **Automatically**: The tag will check for consent signals from Google Consent Mode or Stape's Data Tag.
  - **Manually**: You can provide a custom variable that specifies the consent status (`true`/`false` or `1`/`0`).
- **Enable Unconditional Tracking from Loyalty Platforms**: This is a special setting for **Loyalty Platforms journeys** (identified by the `afloyalty=1` URL query parameter on the landing page URL). When enabled, the tag is allowed to set the Click ID cookie (`affc_cid`) even if the user has not given consent.

## Useful Resources:

- [Step-by-step guide on how to configure Affiliate Future Tag](https://stape.io/helpdesk/documentation/affiliate-future-tag)

## Open Source

The **Affiliate Future Tag for GTM Server-Side** is developed and maintained by the [Stape Team](https://stape.io/) under the Apache 2.0 license.
