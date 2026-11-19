// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface Locals {
			user: string | null;
		}
		interface PageState {
			/** Id of the image open in the viewer. */
			img?: string;
		}
	}
}

export {};
