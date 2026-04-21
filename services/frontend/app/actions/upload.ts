"use server";

const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

export async function uploadVideoAction(formData: FormData) {
	try {
		const backendUrl = `${BACKEND_URL}/api/v1/process`;

		const response = await fetch(backendUrl, {
			method: "POST",
			body: formData,
		});

		if (!response.ok) {
			const text = await response.text().catch(() => "");
			let errorMessage = text || response.statusText || "";

			try {
				const jsonData = JSON.parse(text);
				if (jsonData.detail || jsonData.error || jsonData.message) {
					errorMessage = jsonData.detail || jsonData.error || jsonData.message;
				}
			} catch {}

			const error = new Error(errorMessage || "Ошибка сервера");
			(error as any).statusCode = response.status;
			throw error;
		}

		return await response.json();
	} catch (error) {
		throw error;
	}
}
