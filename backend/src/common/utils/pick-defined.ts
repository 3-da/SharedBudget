/**
 * Picks only the properties from `obj` whose values are not `undefined`.
 * Useful for building partial update objects from DTOs with optional fields.
 *
 * @param obj - Source object (typically a DTO)
 * @param keys - Property names to consider
 * @returns A new object containing only the defined properties
 */
export function pickDefined<T extends Record<string, any>>(obj: T, keys: (keyof T)[]): Partial<T> {
    const result: Partial<T> = {};

    for (const key of keys) {
        if (obj[key] !== undefined) {
            result[key] = obj[key];
        }
    }

    return result;
}
