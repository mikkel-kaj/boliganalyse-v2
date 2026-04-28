#!/usr/bin/env node
// Generate JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY for self-hosted Supabase.
// Output is paste-ready for deploy/.env.example.
// Usage: node deploy/scripts/generate-keys.mjs

import { randomBytes, createHmac } from 'node:crypto';

const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

const sign = (secret, payload) => {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac('sha256', secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
};

const jwtSecret = randomBytes(32).toString('hex');
const iat = Math.floor(Date.now() / 1000);
const exp = iat + 60 * 60 * 24 * 365 * 10;

const anon = sign(jwtSecret, { iss: 'supabase', role: 'anon', iat, exp });
const service = sign(jwtSecret, { iss: 'supabase', role: 'service_role', iat, exp });

process.stdout.write(
  [
    '# Paste these three lines into /opt/supabase-stack/.env',
    `JWT_SECRET=${jwtSecret}`,
    `ANON_KEY=${anon}`,
    `SERVICE_ROLE_KEY=${service}`,
    '',
  ].join('\n'),
);
