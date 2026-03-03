const BigQuery = require('BigQuery');
const encodeUriComponent = require('encodeUriComponent');
const generateRandom = require('generateRandom');
const getAllEventData = require('getAllEventData');
const getContainerVersion = require('getContainerVersion');
const getCookieValues = require('getCookieValues');
const getRequestHeader = require('getRequestHeader');
const getTimestampMillis = require('getTimestampMillis');
const getType = require('getType');
const JSON = require('JSON');
const logToConsole = require('logToConsole');
const makeInteger = require('makeInteger');
const makeString = require('makeString');
const parseUrl = require('parseUrl');
const sendHttpRequest = require('sendHttpRequest');
const setCookie = require('setCookie');

/*==============================================================================
==============================================================================*/

const traceId = getRequestHeader('trace-id');
const eventData = getAllEventData();
const useOptimisticScenario = isUIFieldTrue(data.useOptimisticScenario);

if (
  isConsentDeclined(data, eventData) &&
  !isJourneyExemptFromConsent(data, eventData) /* Only on Page View */
) {
  return data.gtmOnSuccess();
}

const url = eventData.page_location || getRequestHeader('referer');
if (url && url.lastIndexOf('https://gtm-msr.appspot.com/', 0) === 0) {
  return data.gtmOnSuccess();
}

const actionHandlers = {
  pageView: handlePageViewEvent,
  conversion: handleConversionEvent
};

const handler = actionHandlers[data.type];
if (handler) {
  handler(data, eventData);
} else {
  return data.gtmOnFailure();
}

if (useOptimisticScenario) {
  return data.gtmOnSuccess();
}

/*==============================================================================
  Vendor related functions
==============================================================================*/

function isJourneyExemptFromConsent(data, eventData) {
  const url = eventData.page_location || getRequestHeader('referer');
  if (!url) return false;

  const urlSearchParams = parseUrl(url).searchParams;
  if (
    data.enableLoyaltyJourneyTracking /* UI field enabled only on Page View */ &&
    urlSearchParams.afloyalty === '1'
  ) {
    return true;
  }
  return false;
}

function isConsentDeclined(data, eventData) {
  const consentDetection = data.consentDetection;

  if (!consentDetection) return false;

  const autoConsentParameter = data.consentAutoParameter;
  if (consentDetection === 'auto' && autoConsentParameter) {
    // Check consent state from Stape's Data Tag
    if (eventData.consent_state && eventData.consent_state[autoConsentParameter] === false) {
      return true;
    }

    // Check consent state from Google Consent Mode
    const gcsPositionMapping = { analytics_storage: 3, ad_storage: 2 };
    const xGaGcs = eventData['x-ga-gcs'] || ''; // x-ga-gcs is a string like "G110"
    if (xGaGcs[gcsPositionMapping[autoConsentParameter]] === '0') {
      return true;
    }
  } else if (consentDetection === 'manual') {
    // Check template field specific consent signal
    return ['0', 0, 'false', false].indexOf(data.consentManualValue) !== -1;
  }

  return false;
}

function parseClickIdFromUrl(eventData) {
  const url = eventData.page_location || getRequestHeader('referer');
  if (!url) return;

  const urlSearchParams = parseUrl(url).searchParams;
  return urlSearchParams[data.clickIdParameterName || 'affc'];
}

function getClickId(data, eventData) {
  const clickId = data.hasOwnProperty('clickId')
    ? data.clickId
    : parseClickIdFromUrl(eventData) ||
      getCookieValues('affc_cid')[0] || // sGTM cookie
      getCookieValues('Affc')[0]; // JS tag cookie

  return clickId;
}

function handlePageViewEvent(data, eventData) {
  const url = eventData.page_location || getRequestHeader('referer');
  if (!url) return data.gtmOnSuccess();

  const cookieOptions = {
    domain: data.cookieDomain || 'auto',
    samesite: 'Lax',
    path: '/',
    secure: true,
    httpOnly: !!data.cookieHttpOnly,
    'max-age': 60 * 60 * 24 * makeInteger(data.cookieExpiration || 30)
  };

  const clickIdValue = parseClickIdFromUrl(eventData);
  if (clickIdValue) {
    setCookie('affc_cid', clickIdValue, cookieOptions, false);
  }

  return data.gtmOnSuccess();
}

function addProductsData(data, eventData, requestData) {
  const products = data.hasOwnProperty('products') ? data.products : eventData.items || [];
  if (getType(products) === 'array' && products.length > 0) {
    const productsForPLT = products
      .map((p) => {
        return [
          replacePipeWithUnderscore(p.item_id || p.id || ''),
          replacePipeWithUnderscore(p.item_sku || p.sku || ''),
          replacePipeWithUnderscore(p.item_name || p.name || ''),
          replacePipeWithUnderscore(p.item_category || p.category || ''),
          isValidValue(p.price) ? p.price : '',
          p.quantity || ''
        ].join('|');
      })
      .join('|,|');

    requestData.products = productsForPLT;
  }

  return requestData;
}

function mapRequestData(data, eventData) {
  const requestData = {
    merchant: data.merchantId
  };

  const orderId = data.hasOwnProperty('orderId')
    ? data.orderId
    : eventData.orderId || eventData.order_id || eventData.transaction_id;
  if (isValidValue(orderId)) requestData.orderID = orderId;

  const orderValue = data.hasOwnProperty('orderValue') ? data.orderValue : eventData.value;
  if (isValidValue(orderValue)) requestData.orderValue = orderValue;

  const currency = data.hasOwnProperty('currency')
    ? data.currency
    : eventData.currency || eventData.currencyCode;
  if (currency) requestData.curr = currency;

  const clickId = getClickId(data, eventData);
  if (clickId) requestData.affc = clickId;

  const voucher = data.hasOwnProperty('voucher') ? data.voucher : eventData.coupon;
  if (voucher) requestData.voucher = voucher;

  const payoutCodes = data.payoutCodes;
  if (payoutCodes) requestData.payoutCodes = payoutCodes;

  requestData.offlineCode = ''; // Required for the integration to work.

  addProductsData(data, eventData, requestData);

  requestData.r = generateRandom(100000000, 999999999);

  return requestData;
}

function generateRequestBaseUrl() {
  return 'https://scripts.affiliatefuture.com/AFSaleV5.aspx';
}

function generateRequestOptions() {
  const options = {
    method: 'GET'
  };

  return options;
}

function generateRequestUrlParameters(requestData) {
  const requestParametersList = [];
  for (const key in requestData) {
    const value = requestData[key];
    if (key !== 'offlineCode' && !isValidValue(value)) continue;
    requestParametersList.push(enc(key) + '=' + enc(value));
  }

  return requestParametersList.join('&');
}

function areThereRequiredParametersMissing(requestData) {
  const requiredCommonFields = ['orderID', 'orderValue', 'merchant', 'affc'];
  const anyCommonFieldMissing = requiredCommonFields.some((p) => !isValidValue(requestData[p]));
  if (anyCommonFieldMissing) return requiredCommonFields;
}

function sendRequest(data, requestData) {
  const requestUrl = generateRequestBaseUrl(data) + '?' + generateRequestUrlParameters(requestData);
  const requestOptions = generateRequestOptions(data);

  log({
    Name: 'AffiliateFuture',
    Type: 'Request',
    TraceId: traceId,
    EventName: data.type,
    RequestMethod: requestOptions.method,
    RequestUrl: requestUrl
  });

  return sendHttpRequest(
    requestUrl,
    (statusCode, headers, body) => {
      log({
        Name: 'AffiliateFuture',
        Type: 'Response',
        TraceId: traceId,
        EventName: data.type,
        ResponseStatusCode: statusCode,
        ResponseHeaders: headers,
        ResponseBody: body
      });

      if (!useOptimisticScenario) {
        if (statusCode >= 200 && statusCode < 300) {
          data.gtmOnSuccess();
        } else {
          data.gtmOnFailure();
        }
      }
    },
    requestOptions
  );
}

function handleConversionEvent(data, eventData) {
  const requestData = mapRequestData(data, eventData);

  const missingParameters = areThereRequiredParametersMissing(requestData);
  if (missingParameters) {
    log({
      Name: 'AffiliateFuture',
      Type: 'Message',
      TraceId: traceId,
      EventName: data.type,
      Message: 'Request was not sent.',
      Reason: 'One or more required parameters are missing: ' + missingParameters.join(' or ')
    });

    return data.gtmOnFailure();
  }

  return sendRequest(data, requestData);
}

/*==============================================================================
  Helpers
==============================================================================*/

function replacePipeWithUnderscore(data) {
  data = data || '';
  return data.split('|').join('_');
}

function isUIFieldTrue(field) {
  return [true, 'true'].indexOf(field) !== -1;
}

function isValidValue(value) {
  const valueType = getType(value);
  return valueType !== 'null' && valueType !== 'undefined' && value !== '';
}

function enc(data) {
  return encodeUriComponent(makeString(data || ''));
}

function log(rawDataToLog) {
  const logDestinationsHandlers = {};
  if (determinateIsLoggingEnabled()) logDestinationsHandlers.console = logConsole;
  if (determinateIsLoggingEnabledForBigQuery()) logDestinationsHandlers.bigQuery = logToBigQuery;

  const keyMappings = {
    // No transformation for Console is needed.
    bigQuery: {
      Name: 'tag_name',
      Type: 'type',
      TraceId: 'trace_id',
      EventName: 'event_name',
      RequestMethod: 'request_method',
      RequestUrl: 'request_url',
      RequestBody: 'request_body',
      ResponseStatusCode: 'response_status_code',
      ResponseHeaders: 'response_headers',
      ResponseBody: 'response_body'
    }
  };

  for (const logDestination in logDestinationsHandlers) {
    const handler = logDestinationsHandlers[logDestination];
    if (!handler) continue;

    const mapping = keyMappings[logDestination];
    const dataToLog = mapping ? {} : rawDataToLog;

    if (mapping) {
      for (const key in rawDataToLog) {
        const mappedKey = mapping[key] || key;
        dataToLog[mappedKey] = rawDataToLog[key];
      }
    }

    handler(dataToLog);
  }
}

function logConsole(dataToLog) {
  logToConsole(JSON.stringify(dataToLog));
}

function logToBigQuery(dataToLog) {
  const connectionInfo = {
    projectId: data.logBigQueryProjectId,
    datasetId: data.logBigQueryDatasetId,
    tableId: data.logBigQueryTableId
  };

  dataToLog.timestamp = getTimestampMillis();

  ['request_body', 'response_headers', 'response_body'].forEach((p) => {
    dataToLog[p] = JSON.stringify(dataToLog[p]);
  });

  const bigquery =
    getType(BigQuery) === 'function' ? BigQuery() /* Only during Unit Tests */ : BigQuery;
  bigquery.insert(connectionInfo, [dataToLog], { ignoreUnknownValues: true });
}

function determinateIsLoggingEnabled() {
  const containerVersion = getContainerVersion();
  const isDebug = !!(
    containerVersion &&
    (containerVersion.debugMode || containerVersion.previewMode)
  );

  if (!data.logType) {
    return isDebug;
  }

  if (data.logType === 'no') {
    return false;
  }

  if (data.logType === 'debug') {
    return isDebug;
  }

  return data.logType === 'always';
}

function determinateIsLoggingEnabledForBigQuery() {
  if (data.bigQueryLogType === 'no') return false;
  return data.bigQueryLogType === 'always';
}
