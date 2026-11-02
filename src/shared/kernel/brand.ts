declare const brand: unique symbol

/**
 * A nominal type: `Brand<string, 'UserId'>` is a string the compiler won't
 * confuse with any other string. Build one only through its parse function.
 */
export type Brand<T, B extends string> = T & { readonly [brand]: B }
