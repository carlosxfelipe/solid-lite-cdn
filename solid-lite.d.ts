/**
 * @module
 * Solid Lite - A minimalist implementation of the SolidJS reactivity engine.
 * 
 * This module provides fine-grained reactivity and a runtime JSX-like (HyperScript)
 * engine that works directly with the real DOM.
 */

/**
 * Represents a valid child node that can be rendered.
 */
export type Child =
  | Node
  | string
  | number
  | boolean
  | null
  | undefined
  | (() => unknown)
  | Array<Child>;

export type Component<P = Record<string, unknown>> = (
  props: P & { children?: Child[] },
) => Node;

/**
 * Creates a new reactive root. Computations created inside a root are
 * automatically disposed when the root is disposed.
 */
export declare function createRoot<T>(fn: (dispose: () => void) => T): T;

/**
 * Creates a reactive signal.
 */
export declare function createSignal<T>(
  value: T,
  options?: { equals?: false | ((prev: T, next: T) => boolean) },
): [() => T, (v: T | ((prev: T) => T)) => T];

/**
 * Creates a reactive effect that runs when its dependencies change.
 */
export declare function createEffect<T>(fn: (v?: T) => T, value?: T): void;

/**
 * Registers a cleanup function that runs when the current scope is disposed.
 */
export declare function onCleanup(fn: () => void): void;

/**
 * The HyperScript function for creating DOM nodes or components.
 */
export declare function h(
  tag: string | Component<any>,
  props: Record<string, any> | null | undefined,
  ...children: Child[]
): Node;

/**
 * A virtual component that groups multiple children without adding a parent DOM node.
 */
export declare function Fragment(props?: { children?: Child[] }, ...kids: Child[]): DocumentFragment;

/**
 * Renders a Node into a container, clearing the container's previous content.
 */
export declare function render(node: Node, container: Element): void;

/**
 * A component for conditional rendering.
 */
export declare function Show(props: {
  when: () => unknown;
  children: Child;
  fallback?: Child;
}): DocumentFragment;

/**
 * A component for rendering lists with efficient DOM reuse.
 */
export declare function For<T>(props: {
  each: () => T[];
  key?: (item: T) => string | number;
  children?: (item: T, index: () => number) => Child;
}): DocumentFragment;

/**
 * A component for rendering the first Match that satisfies its condition.
 */
export declare function Switch(props: {
  children: Child[];
  fallback?: Child;
}): DocumentFragment;

/**
 * A child component for Switch that specifies a condition and its content.
 */
export declare function Match(props: {
  when: () => unknown;
  children: Child;
}): {
  condition: () => boolean;
  children: Child;
  __isMatch: true;
};
