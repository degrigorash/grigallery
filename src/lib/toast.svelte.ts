export const toast = $state({ message: '', visible: false });

let timer: ReturnType<typeof setTimeout> | undefined;

export function showToast(message: string) {
	toast.message = message;
	toast.visible = true;
	clearTimeout(timer);
	timer = setTimeout(() => (toast.visible = false), 3000);
}
