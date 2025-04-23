declare module 'govuk-frontend' {
    export function initAll(config?: { scope?: HTMLElement | Document }): void;
    // Add other specific exports if you use them directly, e.g.:
    // export class Button { constructor(element: HTMLElement); init(): void; }
    // export class Details { constructor(element: HTMLElement); init(): void; }
    // ... etc.
}
