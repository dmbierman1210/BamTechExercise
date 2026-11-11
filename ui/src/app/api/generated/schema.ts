/**
 * GENERATED FILE - DO NOT EDIT.
 * Source: docs/api/openapi.yaml (the API contract).
 * Regenerate with: npm run generate:api (generator: openapi-typescript).
 * Hand-written code imports these types (see ../models.ts), so a type removed from the contract fails the build.
 */
/* eslint-disable */
export interface paths {
    "/Person": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * List all people
         * @description Returns every person with their current astronaut summary.
         */
        get: operations["getPeople"];
        put?: never;
        /**
         * Add a person
         * @description Creates a person with no duties (`astronautStatus` `None`). The body is an object, not a bare string.
         *     The name is trimmed, 1 to 200 characters, and must not already exist (case-insensitive).
         */
        post: operations["createPerson"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/Person/{name}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get one person */
        get: operations["getPersonByName"];
        /**
         * Rename a person
         * @description Changes the name of the person identified by the path. `newName` follows the same rules as the name on
         *     `POST /Person`. It must not belong to a different person (case-insensitive), but a change of letter case
         *     or surrounding whitespace on the person's own name is allowed. Duties and their history are kept.
         */
        put: operations["renamePerson"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/AstronautDuty/{name}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Get a person with their duty timeline
         * @description Duties are ordered newest start date first. A person with no duty has an empty list.
         */
        get: operations["getAstronautDutiesByName"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/AstronautDuty": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Add a duty to a person
         * @description Appends a duty to the person's timeline according to the duty rules in the API description.
         *     `reason` is required when the start date is in the future, before the person's latest duty start,
         *     or when the person is currently retired.
         */
        post: operations["createAstronautDuty"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        /** @description Envelope present in every response body. */
        BaseResponse: {
            success: boolean;
            message: string;
            /**
             * @description Always equal to the HTTP status code.
             * @example 200
             */
            responseCode: number;
        };
        FieldError: {
            /**
             * @description Name of the offending body property, or `X-Actor` for the header.
             * @example name
             */
            field: string;
            /** @example The name is required. */
            message: string;
        };
        ErrorResponse: components["schemas"]["BaseResponse"] & {
            /** @description Present on validation errors, one entry per invalid field. */
            errors?: components["schemas"]["FieldError"][];
        };
        CreatedResponse: components["schemas"]["BaseResponse"] & {
            /**
             * @description Identifier of the created person or duty.
             * @example 1
             */
            id: number;
        };
        /**
         * @description `None` when the person has no duty, `Active` when the latest duty is not `RETIRED`,
         *     `Retired` when the latest duty is `RETIRED`.
         * @enum {string}
         */
        AstronautStatus: "None" | "Active" | "Retired";
        PersonAstronaut: {
            /** @example 1 */
            personId: number;
            /** @example John Doe */
            name: string;
            /** @example 1LT */
            currentRank?: string | null;
            /** @example Commander */
            currentDutyTitle?: string | null;
            /**
             * Format: date
             * @example 2020-01-15
             */
            careerStartDate?: string | null;
            /**
             * Format: date
             * @example null
             */
            careerEndDate?: string | null;
            astronautStatus: components["schemas"]["AstronautStatus"];
        };
        AstronautDuty: {
            /** @example 2 */
            id: number;
            /** @example 1 */
            personId: number;
            /** @example 1LT */
            rank: string;
            /** @example Commander */
            dutyTitle: string;
            /**
             * Format: date
             * @example 2020-01-15
             */
            dutyStartDate: string;
            /**
             * Format: date
             * @description The day before the next duty starts. Null for the latest duty.
             * @example null
             */
            dutyEndDate?: string | null;
            /**
             * @description Why the duty was entered out of the normal order. Null when no reason was needed.
             * @example null
             */
            reason?: string | null;
        };
        PersonListResponse: components["schemas"]["BaseResponse"] & {
            people: components["schemas"]["PersonAstronaut"][];
        };
        PersonResponse: components["schemas"]["BaseResponse"] & {
            person: components["schemas"]["PersonAstronaut"];
        };
        AstronautDutiesResponse: components["schemas"]["BaseResponse"] & {
            person: components["schemas"]["PersonAstronaut"];
            /** @description Newest start date first. */
            astronautDuties: components["schemas"]["AstronautDuty"][];
        };
        CreatePersonRequest: {
            /** @description Trimmed before validation and storage. Unique, case-insensitive. */
            name: string;
        };
        RenamePersonRequest: {
            /** @description Trimmed before validation and storage. Unique, case-insensitive. */
            newName: string;
        };
        CreateAstronautDutyRequest: {
            /** @description Name of an existing person. */
            name: string;
            rank: string;
            /** @description `RETIRED` (any letter case) retires the person. */
            dutyTitle: string;
            /** Format: date */
            dutyStartDate: string;
            /** @description Required (non-blank) for a future start date, a backdated duty and a return from retirement. */
            reason?: string | null;
        };
    };
    responses: {
        /** @description No person has this name. */
        PersonNotFound: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Unexpected server error. The message is generic and never contains internals. */
        InternalServerError: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
    };
    parameters: {
        /**
         * @description Name of the person. URL-encoded, trimmed, matched case-insensitively. Never longer than 200 characters.
         * @example John Doe
         */
        PersonName: string;
        /**
         * @description Who is making the change. Self-declared and unverified until login exists. Trimmed, 1 to 100 characters;
         *     a missing, blank or longer value is a 400 with a field error on `X-Actor`.
         *     Stored on the audit trail and log entries.
         * @example flight.director
         */
        XActor: string;
    };
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getPeople: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description All people, possibly an empty list. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PersonListResponse"];
                };
            };
            500: components["responses"]["InternalServerError"];
        };
    };
    createPerson: {
        parameters: {
            query?: never;
            header: {
                /**
                 * @description Who is making the change. Self-declared and unverified until login exists. Trimmed, 1 to 100 characters;
                 *     a missing, blank or longer value is a 400 with a field error on `X-Actor`.
                 *     Stored on the audit trail and log entries.
                 * @example flight.director
                 */
                "X-Actor": components["parameters"]["XActor"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "name": "John Doe"
                 *     }
                 */
                "application/json": components["schemas"]["CreatePersonRequest"];
            };
        };
        responses: {
            /** @description The person was created. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreatedResponse"];
                };
            };
            /** @description The body or the `X-Actor` header is invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            /** @description A person with this name already exists (case-insensitive). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            500: components["responses"]["InternalServerError"];
        };
    };
    getPersonByName: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /**
                 * @description Name of the person. URL-encoded, trimmed, matched case-insensitively. Never longer than 200 characters.
                 * @example John Doe
                 */
                name: components["parameters"]["PersonName"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The person. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PersonResponse"];
                };
            };
            404: components["responses"]["PersonNotFound"];
            500: components["responses"]["InternalServerError"];
        };
    };
    renamePerson: {
        parameters: {
            query?: never;
            header: {
                /**
                 * @description Who is making the change. Self-declared and unverified until login exists. Trimmed, 1 to 100 characters;
                 *     a missing, blank or longer value is a 400 with a field error on `X-Actor`.
                 *     Stored on the audit trail and log entries.
                 * @example flight.director
                 */
                "X-Actor": components["parameters"]["XActor"];
            };
            path: {
                /**
                 * @description Name of the person. URL-encoded, trimmed, matched case-insensitively. Never longer than 200 characters.
                 * @example John Doe
                 */
                name: components["parameters"]["PersonName"];
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                /**
                 * @example {
                 *       "newName": "Johnathan Doe"
                 *     }
                 */
                "application/json": components["schemas"]["RenamePersonRequest"];
            };
        };
        responses: {
            /** @description The person was renamed. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["BaseResponse"];
                };
            };
            /** @description The body or the `X-Actor` header is invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            404: components["responses"]["PersonNotFound"];
            /** @description Another person already has `newName` (case-insensitive). */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            500: components["responses"]["InternalServerError"];
        };
    };
    getAstronautDutiesByName: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /**
                 * @description Name of the person. URL-encoded, trimmed, matched case-insensitively. Never longer than 200 characters.
                 * @example John Doe
                 */
                name: components["parameters"]["PersonName"];
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description The person and their duties. */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["AstronautDutiesResponse"];
                };
            };
            404: components["responses"]["PersonNotFound"];
            500: components["responses"]["InternalServerError"];
        };
    };
    createAstronautDuty: {
        parameters: {
            query?: never;
            header: {
                /**
                 * @description Who is making the change. Self-declared and unverified until login exists. Trimmed, 1 to 100 characters;
                 *     a missing, blank or longer value is a 400 with a field error on `X-Actor`.
                 *     Stored on the audit trail and log entries.
                 * @example flight.director
                 */
                "X-Actor": components["parameters"]["XActor"];
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateAstronautDutyRequest"];
            };
        };
        responses: {
            /** @description The duty was added. */
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreatedResponse"];
                };
            };
            /** @description The body, the `X-Actor` header or the reason rule is invalid. */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            404: components["responses"]["PersonNotFound"];
            /** @description The person already has a duty starting on this date. */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            500: components["responses"]["InternalServerError"];
        };
    };
}
