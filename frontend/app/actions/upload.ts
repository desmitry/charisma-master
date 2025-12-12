'use server';

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
      const errorMessage = text || response.statusText || "Upload failed";
      
      if (response.status === 502 || response.status === 503) {
        throw new Error("Сервер недоступен. Проверьте, запущен ли backend.");
      }
      if (response.status === 413) {
        throw new Error("Файл слишком большой. Максимальный размер: 200MB.");
      }
      
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
}

