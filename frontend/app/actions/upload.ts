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
      let errorMessage = text || response.statusText || "";
      
      try {
        const jsonData = JSON.parse(text);
        if (jsonData.detail || jsonData.error || jsonData.message) {
          errorMessage = jsonData.detail || jsonData.error || jsonData.message;
        }
      } catch {
      }
      
      console.error("[Server Action] Backend error:", response.status, errorMessage);
      
      const error = new Error(errorMessage || "Ошибка сервера");
      (error as any).statusCode = response.status;
      throw error;
    }

    const result = await response.json();
    console.log("[Server Action] Upload successful");
    return result;
  } catch (error) {
    console.error("[Server Action] Upload error:", error);
    throw error;
  }
}

