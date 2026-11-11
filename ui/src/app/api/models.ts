import type { components, operations } from './generated/schema';

/** Types are derived from the generated schema so a change to the contract surfaces as a compile error. */
type Schemas = components['schemas'];

export type BaseResponse = Schemas['BaseResponse'];
export type ErrorResponse = Schemas['ErrorResponse'];
export type FieldError = Schemas['FieldError'];
export type CreatedResponse = Schemas['CreatedResponse'];
export type AstronautStatus = Schemas['AstronautStatus'];
export type PersonAstronaut = Schemas['PersonAstronaut'];
export type AstronautDuty = Schemas['AstronautDuty'];
export type PersonListResponse = Schemas['PersonListResponse'];
export type PersonResponse = Schemas['PersonResponse'];
export type AstronautDutiesResponse = Schemas['AstronautDutiesResponse'];
export type CreatePersonRequest = Schemas['CreatePersonRequest'];
export type RenamePersonRequest = Schemas['RenamePersonRequest'];
export type CreateAstronautDutyRequest = Schemas['CreateAstronautDutyRequest'];

/** Operation ids from the contract; referencing them here makes the build fail if one is removed. */
export type OperationId = keyof operations;
