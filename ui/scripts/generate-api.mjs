// Generates the typed API schema from the contract. Usage: npm run generate:api
// Works offline: it reads docs/api/openapi.yaml from this repository.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const here = dirname(fileURLToPath(import.meta.url));
const contract = resolve(here, '../../docs/api/openapi.yaml');
const output = resolve(here, '../src/app/api/generated/schema.ts');

const header = `/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: docs/api/openapi.yaml (the API contract).
 * Regenerate with: npm run generate:api (generator: openapi-typescript).
 * Hand-written code imports these types (see ../models.ts), so a type removed from the contract fails the build.
 */
/* eslint-disable */
`;

const ast = await openapiTS(pathToFileURL(contract));
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, header + astToString(ast), 'utf8');
console.log(`Generated ${output}`);
