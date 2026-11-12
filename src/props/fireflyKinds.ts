// Firefly kinds (props/fireflies.ts), apart so sceneSpec.ts can name them
// without importing the props.

export const FIREFLY_KINDS = ['flash', 'glow', 'synchronous'] as const
export type FireflyKind = (typeof FIREFLY_KINDS)[number]
