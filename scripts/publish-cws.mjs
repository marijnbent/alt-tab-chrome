import { readFileSync } from 'node:fs';

const requiredEnv = [
  'CWS_CLIENT_ID',
  'CWS_CLIENT_SECRET',
  'CWS_REFRESH_TOKEN',
  'CWS_EXTENSION_ID',
  'CWS_PUBLISHER_ID',
  'CWS_ZIP_PATH',
];

for (const name of requiredEnv) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const clientId = process.env.CWS_CLIENT_ID;
const clientSecret = process.env.CWS_CLIENT_SECRET;
const refreshToken = process.env.CWS_REFRESH_TOKEN;
const extensionId = process.env.CWS_EXTENSION_ID;
const publisherId = process.env.CWS_PUBLISHER_ID;
const zipPath = process.env.CWS_ZIP_PATH;

const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }),
});

const tokenData = await parseJson(tokenResponse);
if (!tokenResponse.ok || !tokenData.access_token) {
  throw new Error(`Failed to refresh OAuth token: ${JSON.stringify(tokenData)}`);
}

const accessToken = tokenData.access_token;

const uploadResponse = await fetch(
  `https://chromewebstore.googleapis.com/upload/v2/publishers/${publisherId}/items/${extensionId}:upload`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/zip',
    },
    body: readFileSync(zipPath),
  },
);

let uploadData = await parseJson(uploadResponse);
if (!uploadResponse.ok) {
  throw new Error(`Chrome Web Store upload failed: ${JSON.stringify(uploadData)}`);
}

if (uploadData.uploadState === 'IN_PROGRESS') {
  uploadData = await waitForUpload(accessToken, publisherId, extensionId);
}

const uploadState = uploadData.uploadState ?? uploadData.lastAsyncUploadState;
if (uploadState && uploadState !== 'SUCCEEDED') {
  throw new Error(`Chrome Web Store upload did not succeed: ${JSON.stringify(uploadData)}`);
}

const publishResponse = await fetch(
  `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}:publish`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  },
);

const publishData = await parseJson(publishResponse);
if (!publishResponse.ok) {
  throw new Error(`Chrome Web Store publish failed: ${JSON.stringify(publishData)}`);
}

console.log(`Upload state: ${uploadState ?? 'unknown'}`);
console.log(`Publish response: ${JSON.stringify(publishData)}`);

async function waitForUpload(accessToken, publisherId, extensionId) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(5000);

    const statusResponse = await fetch(
      `https://chromewebstore.googleapis.com/v2/publishers/${publisherId}/items/${extensionId}:fetchStatus`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const statusData = await parseJson(statusResponse);
    if (!statusResponse.ok) {
      throw new Error(`Failed to fetch upload status: ${JSON.stringify(statusData)}`);
    }

    if (statusData.lastAsyncUploadState !== 'IN_PROGRESS') {
      return statusData;
    }
  }

  throw new Error('Timed out waiting for Chrome Web Store upload to finish.');
}

async function parseJson(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
