// Jest is an amazing test runner and has some awesome assertion APIs
// built in by default. However, there are times when having more
// specific matchers (assertions) would be far more convenient.
// https://jest-extended.jestcommunity.dev/docs/matchers/
import 'jest-extended';
// Enable jest-dom functions
import '@testing-library/jest-dom';

import { TextEncoder, TextDecoder } from 'util';

// @ts-expect-error - TextEncoder types don't match perfectly but work at runtime
global.TextEncoder = TextEncoder;
// @ts-expect-error - TextDecoder types don't match perfectly but work at runtime
global.TextDecoder = TextDecoder;
