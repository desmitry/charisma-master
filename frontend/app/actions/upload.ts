'use server';

const BACKEND_URL = process.env.BACKEND_URL || "http://backend:8000";

export async function uploadVideoAction(formData: FormData) {
  console.log("[Server Action] uploadVideoAction called");
  console.log("[Server Action] FormData entries:", Array.from(formData.entries()).map(([k, v]) => [k, v instanceof File ? `File(${v.size} bytes)` : v]));
  
  try {
    const backendUrl = `${BACKEND_URL}/api/v1/process`;
    console.log("[Server Action] Sending to backend:", backendUrl);
    
    const response = await fetch(backendUrl, {
      method: "POST",
      body: formData,
    });

    console.log("[Server Action] Backend response status:", response.status);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      let errorMessage = text || response.statusText || "Upload failed";
      
      try {
        const jsonData = JSON.parse(text);
        if (jsonData.detail || jsonData.error || jsonData.message) {
          errorMessage = jsonData.detail || jsonData.error || jsonData.message;
        }
      } catch {
      }
      
      console.error("[Server Action] Backend error:", response.status, errorMessage);
      
      if (response.status === 502 || response.status === 503) {
        throw new Error("Сервер недоступен. Проверьте, запущен ли backend.");
      }
      if (response.status === 413) {
        throw new Error("Файл слишком большой. Максимальный размер: 200MB.");
      }
      if (response.status === 400 || errorMessage.toLowerCase().includes("не существует") || errorMessage.toLowerCase().includes("video does not exist")) {
        throw new Error("Видео не существует");
      }
      
      throw new Error(errorMessage);
    }

    const result = await response.json();
    console.log("[Server Action] Upload successful");
    return result;
  } catch (error) {
    console.error("[Server Action] Upload error:", error);
    throw error;
  }
}

