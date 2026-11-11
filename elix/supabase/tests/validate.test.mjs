// Unit tests for the pure validation helpers used by the Edge Functions.
// Run:  node --experimental-strip-types supabase/tests/validate.test.mjs
import assert from 'node:assert/strict';
import { normalizeEmail, normalizeMobile, isDisposableEmail, clean, isUuid } from '../functions/_shared/validate.ts';

const rows = [];
const t = (name, fn) => { try { fn(); rows.push(['PASS', name]); } catch (e) { rows.push(['FAIL', `${name}: ${e.message}`]); } };

t('valid email normalised', () => assert.equal(normalizeEmail('  Asha@Example.COM '), 'asha@example.com'));
t('email without domain ending rejected', () => assert.equal(normalizeEmail('a@b'), null));
t('email with double dot rejected', () => assert.equal(normalizeEmail('a..b@example.com'), null));
t('garbage email rejected', () => assert.equal(normalizeEmail('not-an-email'), null));
t('email with SQL injection rejected', () => assert.equal(normalizeEmail("a@b.com'; drop table reviews;--"), null));
t('10-digit mobile gets +91', () => assert.equal(normalizeMobile('98765 43210'), '+919876543210'));
t('+91 mobile accepted', () => assert.equal(normalizeMobile('+91 98765-43210'), '+919876543210'));
t('mobile starting with 5 rejected', () => assert.equal(normalizeMobile('5876543210'), null));
t('9-digit mobile rejected', () => assert.equal(normalizeMobile('987654321'), null));
t('11-digit mobile rejected', () => assert.equal(normalizeMobile('98765432101'), null));
t('91 without + rejected', () => assert.equal(normalizeMobile('919876543210'), null));
t('letters rejected', () => assert.equal(normalizeMobile('98765abcde'), null));
t('mailinator is disposable', () => assert.equal(isDisposableEmail('x@mailinator.com'), true));
t('sub-domain of disposable provider is disposable', () => assert.equal(isDisposableEmail('x@a.mailinator.com'), true));
t('gmail is not disposable', () => assert.equal(isDisposableEmail('x@gmail.com'), false));
t('control characters stripped', () => assert.equal(clean('a\u0000b\u0007c', 10), 'abc'));
t('clean truncates', () => assert.equal(clean('abcdef', 3), 'abc'));
t('uuid check', () => { assert.equal(isUuid('11111111-1111-4111-8111-111111111111'), true); assert.equal(isUuid('nope'), false); });

for (const [r, n] of rows) console.log(r, n);
if (rows.some(([r]) => r === 'FAIL')) process.exit(1);
